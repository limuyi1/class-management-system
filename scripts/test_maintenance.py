"""灾备测试全部使用临时目录，不操作实际教学数据库或附件。"""
import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from maintenance import backup, restore, verify


class MaintenanceTests(unittest.TestCase):
    def test_pair_roundtrip_and_corruption(self):
        """成对恢复、摘要验证以及禁止递归复制。"""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = root / 'live.sqlite'
            attachments = root / 'attachments'
            owner = '00000000-0000-4000-a000-000000000001'
            payload = b'attachment-test'
            digest = hashlib.sha256(payload).hexdigest()
            (attachments / owner).mkdir(parents=True)
            (attachments / owner / digest).write_bytes(payload)
            with sqlite3.connect(database) as connection:
                connection.execute('CREATE TABLE attachment_blobs(ownerId TEXT, hash TEXT, size INTEGER)')
                connection.execute('INSERT INTO attachment_blobs VALUES(?,?,?)', (owner, digest, len(payload)))
                connection.execute('PRAGMA user_version=9')
            destination = root / 'backup'
            backup(database, attachments, destination)
            self.assertEqual(verify(destination)['schema'], 9)
            with self.assertRaisesRegex(RuntimeError, '不能放在'):
                backup(database, attachments, attachments / 'backup')
            restore(destination, root / 'restored.sqlite', root / 'restored-attachments')
            self.assertEqual((root / 'restored-attachments' / owner / digest).read_bytes(), payload)
            (destination / 'attachments' / owner / digest).write_bytes(b'corrupted')
            with self.assertRaises(RuntimeError):
                verify(destination)


if __name__ == '__main__':
    unittest.main()
