// Free RSS feeds for UFC/MMA news. A source works only if article images can be fetched remotely.
const feeds = [
	{ name: 'UFC.com', url: 'https://www.ufc.com/rss/news', allUfc: true },
	{ name: 'ESPN MMA', url: 'https://www.espn.com/espn/rss/mma/news' },
	{ name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/index.xml' },
	{ name: 'Sherdog', url: 'https://www.sherdog.com/rss/news.xml' },
	{ name: 'MMA News', url: 'https://www.mmanews.com/feed' },
	{ name: 'BJPenn.com', url: 'https://www.bjpenn.com/feed/' },
	{ name: 'LowKick MMA', url: 'https://www.lowkickmma.com/feed/' },
	{ name: 'Cageside Press', url: 'https://www.cagesidepress.com/feed' },
	{ name: 'MMA Mania', url: 'https://www.mmamania.com/rss/current.xml' },
	{ name: 'Bloody Elbow', url: 'https://bloodyelbow.com/feed/' },
	{ name: 'MiddleEasy', url: 'https://middleeasy.com/feed/' },
	{ name: 'Fightful', url: 'https://fightful.com/rss.xml' },
	{ name: 'EssentiallySports', url: 'https://www.essentiallysports.com/category/ufc/feed/', allUfc: true },
	{ name: 'Fighters Only', url: 'https://www.fightersonlymag.com/feed' },
	{ name: 'CBS Sports MMA', url: 'https://www.cbssports.com/rss/headlines/mma/' },
];

return feeds.map((feed) => ({ json: feed }));
