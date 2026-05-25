import requests
from bs4 import BeautifulSoup
import time
import json
import argparse
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

# 此爬虫代码：应为libaohao文学网站关闭了搜索功能，我通过对url的逆向，
# 发现了 https://www.libahao.com/分类名/页码 这个有效的URL模式。
# 现扩展为爬取8个分类，每个分类根据其热门/容量大小指定不同页数，
# 以建立更完整的书籍目录，方便查找想看的书籍。
# 运行了一次，成功达到目的了！！！

# 并发参数：可按网络情况调大/调小
MAX_WORKERS = 1  # 默认改为单线程防封
REQUEST_TIMEOUT = 10
RETRY_TIMES = 3
RETRY_503_WAIT = 30.0  # 遇到防封（503或者1Panel墙）时等待长一点时间
PAGE_DELAY = 3.0  # 正常每页之间等待的基础时间


def parse_args():
    """命令行参数，方便直接切换速度策略"""
    parser = argparse.ArgumentParser(description='并发书籍爬虫')
    parser.add_argument('--workers', type=int, default=MAX_WORKERS, help='并发分类数，默认1（单线程防封）')
    parser.add_argument('--pages', type=int, default=300, help='每个分类抓取页数上限')
    parser.add_argument('--timeout', type=int, default=REQUEST_TIMEOUT, help='单次请求超时秒数')
    parser.add_argument('--retries', type=int, default=RETRY_TIMES, help='单页失败重试次数')
    parser.add_argument('--retry503-wait', type=float, default=RETRY_503_WAIT, help='503重试间隔(秒)')
    parser.add_argument('--delay', type=float, default=PAGE_DELAY, help='成功爬取一页后的基础延时(秒)')
    return parser.parse_args()

def fetch_page(category, page_num):
    """获取指定分类和页码的HTML内容"""
    # 构建URL，例如 https://www.libahao.com/xuanhuan/2
    url = f"https://www.libahao.com/{category}/{page_num}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    for attempt in range(RETRY_TIMES + 1):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = 'utf-8'
            if response.status_code == 200:
                return response.text

            # 非200通常是临时异常，短暂等待后重试
            if attempt < RETRY_TIMES:
                time.sleep(0.2 * (attempt + 1))
            else:
                print(f"  [{category}] 第{page_num}页返回状态码：{response.status_code}")
        except Exception as e:
            if attempt < RETRY_TIMES:
                time.sleep(0.2 * (attempt + 1))
            else:
                print(f"  [{category}] 请求第{page_num}页出错：{e}")

    return None


def fetch_page_until_success_on_503(category, page_num):
    """503时无限重试，成功后再进入下一页"""
    url = f"https://www.libahao.com/{category}/{page_num}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    non_503_attempt = 0
    while True:
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = 'utf-8'

            if response.status_code == 200:
                return response.text

            if response.status_code == 503:
                print(f"  [{category}] 第{page_num}页返回503，等待{RETRY_503_WAIT:.1f}s后重试...")
                time.sleep(RETRY_503_WAIT)
                continue

            non_503_attempt += 1
            if non_503_attempt <= RETRY_TIMES:
                time.sleep(0.2 * non_503_attempt)
                continue

            print(f"  [{category}] 第{page_num}页返回状态码：{response.status_code}")
            return None
        except Exception as e:
            # 请求异常也按“必须成功后再往后”的策略重试
            print(f"  [{category}] 第{page_num}页请求异常，等待{RETRY_503_WAIT:.1f}s后重试：{e}")
            time.sleep(RETRY_503_WAIT)


def crawl_category(category, max_pages):
    """单个分类顺序爬取：当前页成功后再爬下一页"""
    category_books = []
    for page in range(1, max_pages + 1):
        html = fetch_page_until_success_on_503(category, page)
        if html is None:
            # 非503且超过重试上限，跳过该页继续后续页
            continue

        books = parse_page(html, page, category)
        if not books:
            # 通常到达该分类尾页
            print(f"  [{category}] 第{page}页没有数据，结束该分类。")
            break

        category_books.extend(books)

        if page % 20 == 0:
            print(f"  [{category}] 已完成到第{page}页，当前分类累计 {len(category_books)} 本")
            
        # 增加随机延时防封，模拟人类浏览
        sleep_time = PAGE_DELAY + random.uniform(0.5, 2.5)
        time.sleep(sleep_time)

    return category, category_books

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
    args = parse_args()

    # 使用命令行参数覆盖默认值
    global MAX_WORKERS, REQUEST_TIMEOUT, RETRY_TIMES, RETRY_503_WAIT, PAGE_DELAY
    MAX_WORKERS = max(1, args.workers)
    REQUEST_TIMEOUT = max(3, args.timeout)
    RETRY_TIMES = max(0, args.retries)
    RETRY_503_WAIT = max(0.2, args.retry503_wait)
    PAGE_DELAY = max(0.0, args.delay)

    # 定义要爬取的分类和对应的最大页数
    # 格式: '分类名': 最大页数
    categories_to_crawl = {
        'xuanhuan': args.pages,
        'xiuzhen': args.pages,
        'dushi': args.pages,
        'lishi': args.pages,
        'wangyou': args.pages,
        'kehuan': args.pages,
        'nvpin': args.pages,
        'qita': args.pages,
    }

    # 并发上限不超过分类数；直接运行 python spider.py 默认使用单线程慢速防封策略
    MAX_WORKERS = min(MAX_WORKERS, len(categories_to_crawl))

    total_tasks = sum(categories_to_crawl.values())
    all_books = []

    print(f"开始并发爬取，共 {len(categories_to_crawl)} 个分类，{total_tasks} 个页面任务，并发分类数 {MAX_WORKERS}")
    print(f"策略：同一分类内按页顺序爬取；若页面503则自动重试直到成功后再进入下一页")

    start_time = time.time()
    completed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(crawl_category, category, max_pages): category
            for category, max_pages in categories_to_crawl.items()
        }

        for future in as_completed(future_map):
            category = future_map[future]
            try:
                _, books = future.result()
                if books:
                    all_books.extend(books)
                completed += categories_to_crawl[category]
                elapsed = time.time() - start_time
                speed = completed / elapsed if elapsed > 0 else 0
                print(f"分类完成: {category}，当前累计 {len(all_books)} 本，估算速度 {speed:.2f} 页/秒")
            except Exception as e:
                print(f"  [{category}] 分类任务异常：{e}")

    # 输出前按分类和页码排序，便于后续检索
    all_books.sort(key=lambda x: (x.get('category', ''), x.get('page', 0), x.get('book_id') or ''))

    # 将所有书籍数据保存到一个文件中
    output_file = 'all_books.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_books, f, ensure_ascii=False, indent=2)

    print(f"\n全部爬取完成！共获取 {len(all_books)} 本书，已保存到 {output_file}")

if __name__ == '__main__':
    main()