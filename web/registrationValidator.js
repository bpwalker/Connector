//
//	jQuery Validate example script
//
//	Prepared by David Cochran
//
//	Free for your use -- No warranties, no guarantees!
//

$(document).ready(function(){
	$.validator.addMethod("lettersonly", function(value, element) {
        	return this.optional(element) || /^[a-z]+$/i.test(value);
	}, "Letters only please");
	
	$.validator.addMethod("phone", function(value, element) {
		return this.optional(element) || /(^\d{10}$)|(^\d{3}-\d{3}-\d{4}$)/i.test(value);
	}, "eg. (1234567890 or 123-456-7890)");

	// Validate
	// http://bassistance.de/jquery-plugins/jquery-plugin-validation/
	// http://docs.jquery.com/Plugins/Validation/
	// http://docs.jquery.com/Plugins/Validation/validate#toptions

	$('#registrationform').validate({
		rules: {
			firstName: {
				minlength: 2,
				required: true,
				lettersonly: true
			},
			lastName: {
				minlength: 2,
				required: true,
			lettersonly: true
			},
			email: {
				required: true,
				email: true
			},
			phoneNumber: {
				phone: true,
				required: true
			},
			password: {
				minlength: 2,
				required: true
			},
			password_confirm: {
				minlength: 2,
				required: true,
				equalTo: "#password"
			}
		},
		highlight: function(element) {
			console.log("highlight");
			//$(element).closest('.control-group').addClass('error');
		},
			success: function(element) {
				console.log("success");
				//element.closest('.control-group').removeClass('error');
		}
	});
}); // end document.ready
