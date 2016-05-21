NEWSCHEMA('Comment').make(function(schema) {

	schema.define('iddocument', 'UID', true);
	schema.define('idissue', 'UID', true);
	schema.define('members', '[Email]');
	schema.define('body', String, true);
	schema.define('document', String, true);  // name of the tracker and it's required for mail message
	schema.define('name', String, true);      // name of the issue and it's required for mail message

	schema.setSave(function(error, model, controller, callback) {

		model.id = UID();
		model.ip = controller.ip;
		model.created = new Date();
		model.hostname = controller.uri.hostname;
		model.email = controller.user.email;

		// Sends email to all members about new comment
		F.mailmembers(model.members, '@(New comment: {0})'.format(model.name), 'comment', model, controller.language);

		delete model.members;
		delete model.name;

		NOSQL('comments').insert(model).callback(() => callback(SUCCESS(true)));
	});
});