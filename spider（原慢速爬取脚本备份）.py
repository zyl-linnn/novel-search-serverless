import requests
from bs4 import BeautifulSoup
import time
import json
import os

# 此爬虫代码：应为libaohao文学网站关闭了搜索功能，我通过对url的逆向，
# 发现了 https://www.libahao.com/分类名/页码 这个有效的URL模式。
# 现扩展为爬取8个分类，每个分类根据其热门/容量大小指定不同页数，
# 以建立更完整的书籍目录，方便查找想看的书籍。
# 运行了一次，成功达到目的了！！！

def fetch_page(category, page_num):
    """获取指定分类和页码的HTML内容"""
    # 构建URL，例如 https://www.libahao.com/xuanhuan/2
    url = f"https://www.libahao.com/{category}/{page_num}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code == 200:
            return response.text
        else:
            print(f"  [{category}] 第{page_num}页返回状态码：{response.status_code}")
            return None
    except Exception as e:
        print(f"  [{category}] 请求第{page_num}页出错：{e}")
        return None

def parse_page(html, page_num, category):
    """解析HTML，提取书籍信息，并添加分类字段"""
    soup = BeautifulSoup(html, 'html.parser')
    books = []

    # 1. 解析“最新更新”表格
    latest_updates = soup.find('div', class_='latest-updates')
    if latest_updates:
        table = latest_updates.find('table')
        if table:
            rows = table.find_all('tr')[1:]  # 跳过表头
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 5:
                    # 书名和链接
                    book_tag = cols[1].find('a')
                    book_title = book_tag.text.strip() if book_tag else ''
                    book_url = book_tag.get('href') if book_tag else ''

                    # 提取书籍ID
                    book_id = extract_book_id(book_url)

                    # 最新章节
                    chapter_tag = cols[2].find('a')
                    latest_chapter = chapter_tag.text.strip() if chapter_tag else ''

                    # 作者
                    author = cols[3].text.strip()

                    # 更新时间
                    update_time = cols[4].text.strip()

                    books.append({
                        'category': category,  # 新增：记录分类
                        'source': 'latest_update',
                        'title': book_title,
                        'url': book_url,
                        'book_id': book_id,
                        'latest_chapter': latest_chapter,
                        'author': author,
                        'update_time': update_time,
                        'page': page_num
                    })

    # 2. 解析“最新入库”列表
    new_books = soup.find('div', class_='new-books-list')
    if new_books:
        ul = new_books.find('ul')
        if ul:
            items = ul.find_all('li')
            for item in items:
                spans = item.find_all('span')
                if len(spans) >= 2:
                    book_tag = spans[0].find('a')
                    book_title = book_tag.text.strip() if book_tag else ''
                    book_url = book_tag.get('href') if book_tag else ''
                    book_id = extract_book_id(book_url)
                    author = spans[1].text.strip()

                    books.append({
                        'category': category,  # 新增：记录分类
                        'source': 'new_books',
                        'title': book_title,
                        'url': book_url,
                        'book_id': book_id,
                        'author': author,
                        'page': page_num
                    })

    return books

def extract_book_id(url):
    """从书籍URL中提取数字ID"""
    if not url:
        return None
    # URL格式如 /book/123456_789/
    import re
    match = re.search(r'/book/(\d+)_', url)
    if match:
        return match.group(1)
    return None

def main():
    # 定义要爬取的分类和对应的最大页数
    # 格式: '分类名': 最大页数
    categories_to_crawl = {
        'xuanhuan': 90,  # 玄幻魔法(指定190页)
        'xiuzhen': 90,   # 武侠修真(指定190页)
        'dushi': 90,     # 都市言情 (指定300页)
        'lishi': 90,     # 历史军事(指定190页)
        'wangyou': 90,   # 游戏竞技(指定190页)
        'kehuan': 90,    # 科幻灵异(指定190页)
        'nvpin': 90,     # 女生言情 (指定300页)
        'qita': 90,      # 其他小说 (指定300页)
    }

    all_books = []  # 存储所有分类的书籍

    # 外层循环：遍历每个分类
    for category, max_pages in categories_to_crawl.items():
        print(f"\n开始爬取分类: {category} (计划爬取 {max_pages} 页)")

        for page in range(1, max_pages + 1):
            print(f"  正在爬取第 {page} 页...")
            html = fetch_page(category, page)

            if html is None:
                print(f"  [{category}] 第 {page} 页无法获取，停止该分类的爬取。")
                break

            books = parse_page(html, page, category)

            if not books:
                # 如果这一页没有提取到任何书籍，可能已经到尾页了
                print(f"  [{category}] 第 {page} 页没有书籍数据，停止该分类的爬取。")
                break

            all_books.extend(books)
            print(f"  [{category}] 第 {page} 页提取到 {len(books)} 本书，累计 {len(all_books)} 本")

            # 等待1秒，避免请求过快
            time.sleep(1)

        print(f"分类 {category} 爬取完成。")

    # 将所有书籍数据保存到一个文件中
    output_file = 'all_books.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_books, f, ensure_ascii=False, indent=2)

    print(f"\n全部爬取完成！共获取 {len(all_books)} 本书，已保存到 {output_file}")

if __name__ == '__main__':
    main()