"""由已提交的 SQL 在内存库生成 Drizzle 描述，不读取或修改实际数据库。"""
import sqlite3,json,re
from pathlib import Path
root=Path('server')
db=sqlite3.connect(':memory:')
for migration in sorted((root/'migrations').glob('*.sql')): db.executescript(migration.read_text())
names=[]
for name,sql in db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    names.append(name)
    cols=db.execute(f'PRAGMA table_info({name})').fetchall()
    types={'INTEGER':'integer','TEXT':'text','REAL':'real','BLOB':'blob'}
    fields=[]
    for _,col,typ,required,default,pk in cols:
        field=f'{col}: {types[typ]}({json.dumps(col)})'
        if required: field+='.notNull()'
        if default is not None: field+=f'.default(sql.raw({json.dumps(default)}))'
        fields.append(field)
    constraints=[]
    primary=sorted((pk,col) for _,col,typ,required,default,pk in cols if pk)
    if primary: constraints.append('primaryKey({columns:['+','.join('table.'+col for _,col in primary)+']})')
    for _,idx,unique,origin,partial in db.execute(f'PRAGMA index_list({name})').fetchall():
        if origin=='pk': continue
        columns=[item[2] for item in db.execute(f'PRAGMA index_info({idx})')]
        if origin=='u': constraints.append('unique().on('+','.join('table.'+col for col in columns)+')')
        else:
            fragment=('uniqueIndex' if unique else 'index')+f'({json.dumps(idx)}).on('+','.join('table.'+col for col in columns)+')'
            if partial:
                idxsql=db.execute('SELECT sql FROM sqlite_master WHERE name=?',(idx,)).fetchone()[0]
                fragment+=f'.where(sql.raw({json.dumps(re.split("WHERE",idxsql,flags=re.I)[1].strip())}))'
            constraints.append(fragment)
    foreign={}
    for ident,seq,target,fromcol,tocol,onupdate,ondelete,match in db.execute(f'PRAGMA foreign_key_list({name})'):
        foreign.setdefault(ident,[]).append((seq,target,fromcol,tocol,onupdate,ondelete))
    for values in foreign.values():
        values.sort(); constraints.append('foreignKey({columns:['+','.join('table.'+v[2] for v in values)+'],foreignColumns:['+','.join(f'schemaColumn({json.dumps(v[1])},{json.dumps(v[3])})' for v in values)+']}).onUpdate('+json.dumps(values[0][4].lower())+').onDelete('+json.dumps(values[0][5].lower())+')')
    for i,match in enumerate(re.finditer(r'CHECK\s*\(',sql,re.I)):
        start=match.end();depth=1;end=start;quote=False
        while depth:
            char=sql[end]
            if char=="'": quote=not quote
            if not quote:
                if char=='(': depth+=1
                if char==')':depth-=1
            end+=1
        constraints.append(f'check({json.dumps(name+"_check_"+str(i))},sql.raw({json.dumps(sql[start:end-1])}))')
    imports={'sqliteTable'}|{types[typ] for _,col,typ,*_ in cols}|{re.match(r'\w+',c)[0] for c in constraints}
    header="import { sql } from 'drizzle-orm'\nimport { "+','.join(sorted(imports))+" } from 'drizzle-orm/sqlite-core'\nimport { registerSchema"+(',schemaColumn' if foreign else '')+" } from './registry.js'\n"
    if not any(default is not None for _,col,typ,required,default,pk in cols) and not any(c.startswith('check(') or '.where(' in c for c in constraints): header=header.replace("import { sql } from 'drizzle-orm'\n",'')
    content=header+f'\n/** {name} 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */\nexport const {name} = registerSchema({json.dumps(name)},sqliteTable({json.dumps(name)},{{'+',\n'.join(fields)+'},table=>['+',\n'.join(constraints)+']))\n'
    (root/'src/db/schema'/f'{name}.ts').write_text(content)
(root/'src/db/schema.ts').write_text('/** 全量加载表描述以解析跨表外键；生产建表只运行已审核 SQL。 */\n'+'\n'.join(f"export {{ {name} }} from './schema/{name}.js'" for name in names)+'\n')
