NEWSCHEMA('Document').make(function(schema) {

	schema.define('id', 'UID', 'backup');
	schema.define('name', String, true);

	schema.setRemove(function(error, controller, callback) {
		NOSQL('documents').one().make(function(builder) {
			builder.where('id', controller.uid);
			builder.where('email', controller.user.email);
			builder.callback(function(err, response) {

				if (err || !response) {
					callback(SUCCESS(false));
					return;
				}

				var async = [];

				async.push(function(next) {
					NOSQL('documents').backup(true).make(function(builder) {
						builder.where('id', controller.uid);
						builder.callback(next);
					});
				});

				async.push(function(next) {
					NOSQL('issues').backup(true).make(function(builder) {
						builder.where('iddocument', controller.uid);
						builder.callback(next);
					});
				});

				async.push(function(next) {
					NOSQL('comments').backup(true).make(function(builder) {
						builder.where('iddocument', controller.uid);
						builder.callback(next);
					});
				});

				async.async(() => callback(SUCCESS(true)));
			});
		});
	});

	// Creates or Updates a specific issue
	schema.setSave(function(error, model, controller, callback) {
		model.id = UID();
		model.ip = controller.ip;
		model.created = new Date();
		model.email = controller.user.email;
		model.hostname = controller.uri.hostname;
		NOSQL('documents').insert(model).callback(() => callback(SUCCESS(true, model.id)));
	});

	schema.setQuery(function(error, controller, callback) {
		NOSQL('documents').find().make(function(builder) {
			builder.where('iscompleted', '!=', true);
			builder.where('email', controller.user.email);

			if (controller.query.hostname)
				builder.where('hostname', controller.query.hostname);

			builder.callback(callback);
		});
	});

	// Reads a specific issue
	schema.setGet(function(error, model, controller, callback) {

		NOSQL('documents').one().make(function(builder) {

			builder.where('id', controller.uid);
			builder.callback(function(err, response) {

				if (!response) {
					error.push('error-document-notfound');
					return callback();
				}

				var async = [];

				async.push(function(resume) {
					NOSQL('issues').find().make(function(builder) {
						builder.where('iddocument', controller.uid);
						builder.callback(function(err, issues) {
							response.issues = issues;
							resume();
						});
					});
				});

				async.push(function(resume) {
					NOSQL('comments').find().make(function(builder) {
						builder.where('iddocument', controller.uid);
						builder.callback(function(err, comments) {
							response.comments = comments;
							resume();
						});
					});
				});

				async.async(() => callback(response));
			});
		});
	});
});