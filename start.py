#!/usr/bin/env python3
"""本地开发一键入口。依赖安装、端口释放均按用户审核的默认行为执行。"""
from scripts.dev_launcher.launcher import main

if __name__ == '__main__':
    raise SystemExit(main())
