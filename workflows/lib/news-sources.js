// Free RSS feeds for UFC/MMA news. A source works only if article images can be fetched remotely.
const feeds = [
	{ name: 'UFC.com', url: 'https://www.ufc.com/rss/news', allUfc: true },
	{ name: 'ESPN MMA', url: 'https://www.espn.com/espn/rss/mma/news' },
	{ name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/index.xml' },
	{ name: 'Sherdog', url: 'https://www.sherdog.com/rss/news.xml' },
	{ name: 'MMA News', url: 'https://www.mmanews.com/feed' },
	{ name: 'BJPenn.com', url: 'https://bjpenn.com/feed/' },
	{ name: 'LowKick MMA', url: 'https://www.lowkickmma.com/feed/' },
	{ name: 'Cageside Press', url: 'https://www.cagesidepress.com/feed' },
];

return feeds.map((feed) => ({ json: feed }));