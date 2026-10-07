"""协调依赖检测、端口释放、迁移与服务启动，失败清理本次子进程。"""
import argparse
from pathlib import Path
import os
import signal
import subprocess
import time
import urllib.request

from .environment import check_runtime, configure, ensure_dependencies, run
from .ports import release_port


def wait_ready(url: str, process: subprocess.Popen, timeout: int = 30) -> None:
    """健康检查前持续检测子进程，避免后端失败而前端仍显示启动成功。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'服务提前退出，退出码 {process.returncode}')
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(0.2)
    raise RuntimeError(f'服务就绪检查超时：{url}')


def stop(process: subprocess.Popen) -> None:
    """只终止本次创建的进程组，不能误杀后来占用相同端口的其他服务。"""
    if os.name == 'nt':
        if process.poll() is not None:
            return
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    process.wait(timeout=5)


def main() -> int:
    """默认安装缺失依赖并释放配置端口；--check 不执行任何修改或启动。"""
    parser = argparse.ArgumentParser(description='班务管理系统：本地开发一键启动')
    parser.add_argument('--check', action='store_true', help='只检测，不安装/释放端口/启动')
    parser.add_argument('--no-install', action='store_true', help='禁止自动安装依赖')
    parser.add_argument('--no-release-ports', action='store_true', help='禁止自动结束占用端口的进程')
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    processes = []
    try:
        pnpm = check_runtime(root)
        ports = configure(root, arguments.check)
        ensure_dependencies(root, pnpm, arguments.no_install, arguments.check)
        for port in ports:
            release_port(port, arguments.no_release_ports, arguments.check)
        if arguments.check:
            print('检查通过。')
            return 0
        run([pnpm, 'db:migrate'], root)
        options = {'cwd': root, 'start_new_session': os.name != 'nt'}
        backend = subprocess.Popen([pnpm, '--filter', '@class-management/server', 'dev'], **options)
        processes.append(backend)
        wait_ready(f'http://127.0.0.1:{ports[1]}/api/v1/health', backend)
        frontend = subprocess.Popen([pnpm, '--filter', '@class-management/ui', 'dev'], **options)
        processes.append(frontend)
        wait_ready(f'http://127.0.0.1:{ports[0]}', frontend)
        print(f'前端：http://127.0.0.1:{ports[0]}；后端：http://127.0.0.1:{ports[1]}')
        print('首次使用请打开页面创建管理员并保存临时密码。按 Ctrl+C 停止本次服务。')
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
        raise RuntimeError('一个服务异常退出，正在停止另一服务。')
    except KeyboardInterrupt:
        print('\n正在停止本次启动的服务。')
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f'启动失败：{error}')
        return 1
    finally:
        for process in reversed(processes):
            stop(process)
