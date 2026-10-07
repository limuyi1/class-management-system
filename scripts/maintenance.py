#!/usr/bin/env python3
"""SQLite 与附件的离线成对备份、校验及恢复；不保存 AI 加密主密钥。"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import sqlite3
import tempfile
from datetime import datetime


def verify(root: Path) -> dict:
    """检查数据库约束及所有历史/删除附件的大小和摘要，损坏则停止。"""
    metadata = json.loads((root / 'manifest.json').read_text())
    database = root / 'database.sqlite'
    if database.is_symlink() or (root / 'attachments').is_symlink():
        raise RuntimeError('备份中不能使用符号链接')
    with sqlite3.connect(f'{database.as_uri()}?mode=ro', uri=True) as connection:
        if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('数据库完整性校验失败')
        if connection.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('数据库外键校验失败')
        if connection.execute('PRAGMA user_version').fetchone()[0] != metadata['schema']:
            raise RuntimeError('备份 schema 不一致')
        for owner, digest, size in connection.execute('SELECT ownerId,hash,size FROM attachment_blobs'):
            if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', owner) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
                raise RuntimeError('存储路径无效')
            file = root / 'attachments' / owner / digest
            if file.parent.is_symlink() or file.is_symlink() or not file.is_file() or file.stat().st_size != size:
                raise RuntimeError('附件缺失或大小错误')
            if hashlib.sha256(file.read_bytes()).hexdigest() != digest:
                raise RuntimeError('附件摘要错误')
    if hashlib.sha256(database.read_bytes()).hexdigest() != metadata['databaseSha256']:
        raise RuntimeError('数据库文件摘要错误')
    return metadata


def backup(database: Path, attachments: Path, destination: Path) -> Path:
    """服务全部停止后，Online Backup 生成主库，复制附件，再原子发布目录。"""
    if attachments.resolve() == destination.resolve() or attachments.resolve() in destination.resolve().parents:
        raise RuntimeError('备份目录不能放在源附件目录内')
    if not database.is_file() or destination.exists():
        raise RuntimeError('源数据库不存在或备份目录已存在')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='cms-backup-', dir=destination.parent))
    try:
        with sqlite3.connect(f'{database.as_uri()}?mode=ro', uri=True) as source:
            with sqlite3.connect(temporary / 'database.sqlite') as target:
                source.backup(target)
                schema = target.execute('PRAGMA user_version').fetchone()[0]
        if attachments.exists():
            if attachments.is_symlink() or any(path.is_symlink() for path in attachments.rglob('*')):
                raise RuntimeError('附件目录不能含符号链接')
            shutil.copytree(attachments, temporary / 'attachments')
        else:
            (temporary / 'attachments').mkdir()
        metadata = {'schema': schema, 'createdAt': datetime.now().isoformat(),
                    'databaseSha256': hashlib.sha256((temporary / 'database.sqlite').read_bytes()).hexdigest()}
        (temporary / 'manifest.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        verify(temporary)
        temporary.rename(destination)
        return destination
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def restore(source: Path, database: Path, attachments: Path) -> None:
    """先验证并保留当前可回退副本，恢复失败不自动删除任何历史备份。"""
    if source.resolve() == attachments.resolve() or source.resolve() in attachments.resolve().parents or attachments.resolve() in source.resolve().parents:
        raise RuntimeError('恢复来源与目标附件目录不能重叠')
    verify(source)
    if database.is_symlink() or attachments.is_symlink():
        raise RuntimeError('目标不能是符号链接')
    if database.exists():
        fallback = database.parent / f'before-restore-{datetime.now().strftime("%Y%m%d-%H%M%S-%f")}'
        backup(database, attachments, fallback)
        print(f'回退副本：{fallback}')
    database.parent.mkdir(parents=True, exist_ok=True)
    attachments.parent.mkdir(parents=True, exist_ok=True)
    staged_file = database.with_name(database.name + '.restore.tmp')
    staged_directory = attachments.with_name(attachments.name + '.restore.tmp')
    if staged_file.exists() or staged_directory.exists():
        raise RuntimeError('存在未处理的恢复临时文件，请先核对')
    shutil.copy2(source / 'database.sqlite', staged_file)
    shutil.copytree(source / 'attachments', staged_directory)
    old_directory = attachments.with_name(attachments.name + f'.before-restore-{datetime.now().strftime("%Y%m%d-%H%M%S-%f")}')
    if attachments.exists():
        attachments.rename(old_directory)
    try:
        staged_directory.rename(attachments)
        # 已显式声明服务停止；不能把旧库 WAL/SHM 留给新库。
        for suffix in ['-wal', '-shm']:
            database.with_name(database.name + suffix).unlink(missing_ok=True)
        os.replace(staged_file, database)
    except Exception:
        if attachments.exists():
            attachments.rename(staged_directory)
        if old_directory.exists():
            old_directory.rename(attachments)
        raise


def main() -> None:
    """只检测 verify 不需要停服；backup/restore 需要调用者显式确认停服状态。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['backup', 'verify', 'restore'])
    parser.add_argument('--database', type=Path)
    parser.add_argument('--attachments', type=Path)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--services-stopped', action='store_true')
    args = parser.parse_args()
    root = args.directory.resolve()
    if args.action == 'verify':
        print(json.dumps(verify(root), ensure_ascii=False)); return
    if not args.services_stopped or not args.database or not args.attachments:
        parser.error('备份/恢复须显式提供数据库、附件目录以及 --services-stopped')
    database, attachments = args.database.resolve(), args.attachments.resolve()
    if args.action == 'backup':
        print(backup(database, attachments, root))
    else:
        restore(root, database, attachments)
        print('成对恢复完成；启动前请使用匹配程序检查 schema，并配置原 AI_ENCRYPTION_KEY')


if __name__ == '__main__':
    main()
