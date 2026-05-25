import os
import json
import glob
from pathlib import Path

def setup_data():
    input_files = glob.glob('all_books*.json')
    if not input_files:
        print("未找到任何 all_books*.json 文件。")
        return

    unique_books = {}
    total_processed = 0

    print("开始读取并去重数据...")
    for file_path in input_files:
        print(f"正在处理文件: {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # 假设文件是以列表包裹的对象格式
                data = json.load(f)
                for item in data:
                    total_processed += 1
                    book_id = item.get('book_id') or item.get('url') # 备用以URL为标识
                    if book_id not in unique_books:
                        unique_books[book_id] = {
                            'title': item.get('title', '').replace("'", "''"), # 转义单引号
                            'url': item.get('url', '').replace("'", "''"),
                            'book_id': str(book_id).replace("'", "''")
                        }
        except Exception as e:
            print(f"读取 {file_path} 失败: {e}")

    books_list = list(unique_books.values())
    total_books = len(books_list)
    print(f"总计读取记录: {total_processed}")
    print(f"去重后书籍数: {total_books}")

    output_file = 'import.sql'
    batch_size = 500  # D1 推荐批量操作不超过 500 条记录左右以避免超时
    
    print(f"正在生成 {output_file} ...")
    with open(output_file, 'w', encoding='utf-8') as f:
        # 第一部分：创建表结构
        f.write("-- 自动生成的表结构，如果已有表可忽略执行这一部分或在后台创建\n")
        f.write("CREATE TABLE IF NOT EXISTS books (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  title TEXT NOT NULL,\n  url TEXT NOT NULL,\n  book_id TEXT UNIQUE\n);\n")
        f.write("CREATE INDEX IF NOT EXISTS idx_title ON books(title);\n\n")
        
        f.write("CREATE TABLE IF NOT EXISTS stats (\n  id INTEGER PRIMARY KEY CHECK (id = 1),\n  total_queries INTEGER DEFAULT 0\n);\n")
        f.write("INSERT OR IGNORE INTO stats (id, total_queries) VALUES (1, 0);\n\n")

        # 第二部分：插入数据
        for i in range(0, total_books, batch_size):
            batch = books_list[i:i + batch_size]
            
            values = []
            for b in batch:
                title = b['title']
                url = b['url']
                book_id = b['book_id']
                values.append(f"('{title}', '{url}', '{book_id}')")
                
            insert_stmt = f"INSERT OR IGNORE INTO books (title, url, book_id) VALUES {','.join(values)};\n"
            f.write(insert_stmt)
            f.write("\n")

    print(f"完成！请使用 wrangler d1 execute novel_db --file={output_file} 导入数据。")
    print("注意: 由于文件较大，导入可能需要一定时间。如果D1报告超时或文件太大，可以搭配 wrangler d1 execute 的 --batch 参数或分隔 SQL 文件执行。")

if __name__ == "__main__":
    setup_data()
