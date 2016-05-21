Tangular.register('photo', function(value) {
	return '/photos/' + value.replace(/@|\./g, '_') + '.jpg';
});

Tangular.register('counter', function(value) {
	return value + 1;
});

function smilefy(text) {
	var db = { ':-)': 1, ':)': 1, ';)': 8, ':D': 0, '8)': 5, ':((': 7, ':(': 3, ':|': 2, ':P': 6, ':O': 4, ':*': 9, '+1': 10, '1': 11, '\/': 12 };
	return text.replace(/(\-1|[:;8O\-)DP(|\*]|\+1){1,3}/g, function(match) {
		var clean = match.replace('-', '');
		var smile = db[clean];
		if (smile === undefined)
			return match;
		return '<span class="smiles smiles-' + smile + '"></span>';
	});
}

function urlify(text) {
	var urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
	return text.replace(urlRegex, function(url,b,c) {
		var url2 = c === 'www.' ? 'http://' + url : url;
		return '<a href="' +url2+ '" target="_blank">' + url + '</a>';
	}) ;
}