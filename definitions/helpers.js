// Sends a message to multiple email addresses
F.mailmembers = function(members, subject, view, model, language) {

	if (!members || !members.length)
		return;

	var messages = [];

	for (var i = 0, length = members.length; i < length; i++) {
		var message = F.mail(members[i], subject, '~mails/' + view, model, language || '');
		message.manually();
		messages.push(message);
	}

	Mail.send2(messages);
};