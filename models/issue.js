NEWSCHEMA('Issue').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('iddocument', 'UID', true);
	schema.define('name', String, true);
	schema.define('document', String, true);

	// Creates or Updates a specific issue
	schema.setSave(function(error, model, controller, callback) {
		model.id = UID();
		model.email = controller.user.email;
		model.ip = controller.ip;
		model.created = new Date();
		model.hostname = controller.uri.hostname;
		NOSQL('issues').insert(model).callback(() => callback(SUCCESS(true, model.id)));
	});

	schema.setQuery(function(error, controller, callback) {
		NOSQL('issues').find().make(function(builder) {
			builder.where('iscompleted', '!=', true);
			builder.where('email', controller.user.email);

			if (controller.query.hostname)
				builder.where('hostname', controller.query.hostname);

			builder.callback(callback);
		});
	});
});

NEWSCHEMA('IssueComplete').make(function(schema) {

	schema.define('id', 'UID', true);
	schema.define('iddocument', 'UID', true);   // required for mail message
	schema.define('name', 'String', true);      // required for mail message
	schema.define('members', '[Email]');        // required for mail message
	schema.define('iscompleted', 'Boolean');

	schema.setSave(function(error, model, controller, callback) {
		var data = {};

		data.iscompleted = model.iscompleted;

		if (data.iscompleted)
			data.completed = new Date();

		NOSQL('issues').modify(data).make(function(builder) {
			builder.where('id', model.id);
			builder.where('email', controller.user.email);
			builder.first();
			builder.callback(() => callback(SUCCESS(true)));
		});

		if (!data.iscompleted)
			return;

		model.created = new Date();
		model.hostname = controller.uri.hostname;
		F.mailmembers(model.members, '@(Issue is solved: {0})'.format(model.name), 'solved', model, controller.language);
	});
});