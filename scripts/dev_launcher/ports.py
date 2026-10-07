"""精确识别配置端口监听者，自动结束，不扩大为同名进程批量终止。"""
import os
import platform
import shutil
import signal
import subprocess
import time


def listeners(port: int) -> set[int]:
    """查询监听 PID；系统工具缺失时停止，不把未知占用当成空闲。"""
    if platform.system() == 'Windows':
        result = subprocess.run(['netstat', '-ano', '-p', 'tcp'], capture_output=True, text=True, check=True)
        found = set()
        for line in result.stdout.splitlines():
            values = line.split()
            if len(values) == 5 and values[3] == 'LISTENING' and values[1].rsplit(':', 1)[-1] == str(port):
                found.add(int(values[4]))
        return found
    if not shutil.which('lsof'):
        raise RuntimeError('端口检测需要 lsof，请安装后重试；脚本不自动安装系统工具。')
    result = subprocess.run(['lsof', '-nP', '-t', f'-iTCP:{port}', '-sTCP:LISTEN'], capture_output=True, text=True)
    if result.returncode not in (0, 1) or (result.returncode == 1 and result.stderr.strip()):
        raise RuntimeError(f'端口 {port} 检测失败：{result.stderr.strip()}')
    return {int(value) for value in result.stdout.split()}


def identity(pid: int) -> str:
    """记录进程启动时间，结束前重新比对以降低 PID 复用误杀风险。"""
    if platform.system() == 'Windows':
        command = ['powershell', '-NoProfile', '-Command',
                   f'Get-Process -Id {pid} | Select-Object Id,StartTime,ProcessName | ConvertTo-Json -Compress']
    else:
        command = ['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'comm=']
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode or not result.stdout.strip():
        raise RuntimeError(f'无法可靠核验进程 {pid}，停止启动。')
    return result.stdout.strip()


def terminate(pid: int, force: bool) -> None:
    """按 PID 停止进程；权限不足原样报告，不调用 sudo。"""
    if platform.system() == 'Windows':
        command = ['taskkill', '/PID', str(pid)] + (['/F'] if force else [])
        subprocess.run(command, check=True, capture_output=True, text=True)
    else:
        os.kill(pid, signal.SIGKILL if force else signal.SIGTERM)


def release_port(port: int, disabled: bool = False, check: bool = False) -> None:
    """自动释放配置端口，包括非本项目的占用者；只检测模式绝不结束进程。"""
    for pid in listeners(port):
        if pid <= 1 or pid == os.getpid():
            raise RuntimeError(f'端口 {port} 被无法终止的启动/系统进程占用。')
        original = identity(pid)
        print(f'端口 {port} 占用进程 {pid}：{original}')
        if disabled or check:
            raise RuntimeError(f'端口 {port} 正在占用；当前模式不自动释放。')
        if pid not in listeners(port):
            continue
        if identity(pid) != original:
            raise RuntimeError(f'进程 {pid} 身份发生变化，停止释放。')
        print(f'自动停止进程 {pid}；未保存内容可能丢失。')
        try:
            terminate(pid, False)
        except ProcessLookupError:
            continue
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline and pid in listeners(port):
            time.sleep(0.1)
        if pid in listeners(port):
            if identity(pid) != original:
                raise RuntimeError('端口占用进程已变化，停止释放。')
            terminate(pid, True)
    deadline = time.monotonic() + 3
    while listeners(port) and time.monotonic() < deadline:
        time.sleep(0.1)
    if listeners(port):
        raise RuntimeError(f'端口 {port} 未成功释放，停止启动。')
