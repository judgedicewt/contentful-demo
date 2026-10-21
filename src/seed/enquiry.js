/** The enquiryForm singleton (entry id `enquiry-form`). */
const entries = [
  {
    id: 'enquiry-form',
    contentType: 'enquiryForm',
    fields: {
      title: 'Enquire',
      intro: 'Tell us which model you are interested in and a McLaren retailer will be in touch.',
      endpoint: 'https://hook.fusion.adobe.com/7hpg8v3lxbu7msjazssngoim6ea9bkhp',
      submitLabel: 'Send enquiry',
      consentText:
        'I agree to McLaren Automotive contacting me about this enquiry. This is a demo: submissions create a request in a test Workfront queue.',
      successTitle: 'Thank you',
      successBody: 'Your enquiry has been received and a request has been raised with our team.',
      errorBody: 'We could not send your enquiry. Please try again in a moment.',
    },
  },
];

export const ENQUIRY_GROUP = { name: 'enquiry', assets: [], entries };
