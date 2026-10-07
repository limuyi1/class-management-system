"""检测运行时、工作区依赖和开发配置，不修改系统安装或现有配置。"""
from pathlib import Path
import hashlib
import os
import shutil
import subprocess


def run(command: list[str], root: Path) -> None:
    """执行参数数组并保留错误，不使用 shell 拼接用户输入。"""
    subprocess.run(command, cwd=root, check=True)


def check_runtime(root: Path) -> str:
    """返回 pnpm 路径；系统运行时缺失时明确停止。"""
    node = shutil.which('node')
    pnpm = shutil.which('pnpm') or shutil.which('pnpm.cmd')
    if not node or not pnpm:
        raise RuntimeError('请先安装 Node.js 22.13+ 和 pnpm 10；脚本不会自动安装系统软件。')
    version = subprocess.check_output([node, '--version'], text=True).strip().lstrip('v')
    if tuple(map(int, version.split('.')[:2])) < (22, 13):
        raise RuntimeError(f'Node.js {version} 不受支持，请使用 22.13+ LTS。')
    manager = subprocess.check_output([pnpm, '--version'], text=True).strip()
    if int(manager.split('.')[0]) < 10:
        raise RuntimeError('请使用 pnpm 10 或更新版本。')
    return pnpm


def dependency_fingerprint(root: Path) -> str:
    """锁文件和包清单共同确定依赖版本，源码变动不导致重复安装。"""
    digest = hashlib.sha256()
    for filename in ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json',
                     'ui/package.json', 'server/package.json', 'packages/shared/package.json']:
        digest.update((root / filename).read_bytes())
    return digest.hexdigest()


def ensure_dependencies(root: Path, pnpm: str, no_install: bool, check: bool) -> None:
    """依赖不完整时按锁文件安装，失败不升级、不清理 node_modules。"""
    fingerprint = dependency_fingerprint(root)
    marker = root / '.launcher' / 'dependencies.sha256'
    suffix = '.cmd' if os.name == 'nt' else ''
    complete = all((root / path).exists() for path in [
        f'ui/node_modules/.bin/vite{suffix}', f'server/node_modules/.bin/tsx{suffix}',
        'server/node_modules/fastify', 'server/node_modules/better-sqlite3'])
    matching = marker.exists() and marker.read_text().strip() == fingerprint
    if complete and matching:
        print('项目依赖检测通过。')
        return
    if check or no_install:
        raise RuntimeError('工作区依赖缺失或未验证；请运行 pnpm install --frozen-lockfile 后再启动。')
    print('检测到项目依赖缺失或变化，按锁文件安装；不修改依赖版本。')
    run([pnpm, 'install', '--frozen-lockfile'], root)
    marker.parent.mkdir(exist_ok=True)
    marker.write_text(fingerprint + '\n')


def read_env(path: Path) -> dict[str, str]:
    """读取简单 KEY=VALUE 配置，不执行文件中的 shell 或 Python 表达式。"""
    result = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if '=' in line and not line.strip().startswith('#'):
                key, value = line.split('=', 1)
                result[key.strip()] = value.strip().strip('"\'')
    return result


def configure(root: Path, check: bool) -> tuple[int, int]:
    """只创建缺失的开发环境文件；已有文件保留用户配置。"""
    for name in ['ui', 'server']:
        target = root / name / '.env'
        if not target.exists() and not check:
            shutil.copyfile(root / name / '.env.example', target)
    ui = read_env(root / 'ui' / '.env')
    server = read_env(root / 'server' / '.env')
    ports = (int(ui.get('VITE_PORT', '5173')), int(server.get('PORT', '3000')))
    if ports[0] == ports[1] or any(port < 1024 or port > 65535 for port in ports):
        raise RuntimeError('前后端端口须不同，且在 1024–65535 范围。')
    expected_origin = f"http://{ui.get('VITE_HOST', '127.0.0.1')}:{ports[0]}"
    if server.get('WEB_ORIGIN', 'http://127.0.0.1:5173') != expected_origin:
        raise RuntimeError('server WEB_ORIGIN 与 ui 的地址不一致，请校对环境配置。')
    return ports
