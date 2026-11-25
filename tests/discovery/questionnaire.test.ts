import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createDiscoveryQuestionnaireAnswers,
  getDiscoveryQuestionnaireStepFields,
  isDiscoveryQuestionnaireFieldVisible,
  toggleDiscoveryQuestionnaireOption,
  updateDiscoveryQuestionnaireAnswer,
  validateDiscoveryQuestionnaireStep,
} from '../../src/lib/discovery/questionnaire-core';
import {
  normalizeDiscoveryPhoneNumber,
  normalizeDiscoveryWebsiteUrl,
  phoneAnswerFromInput,
} from '../../src/lib/discovery/contact-normalization';
import { createDiscoveryQuestionnaireStateStore } from '../../src/lib/discovery/questionnaire-memory-state';
import {
  formatDiscoveryDateDisplay,
  formatDiscoveryDateOnly,
  parseDiscoveryDateDisplay,
  parseDiscoveryDateOnly,
} from '../../src/lib/discovery/date-only';
import {
  DISCOVERY_QUESTIONNAIRE_VERSION,
  approvedBriefFieldIds,
  discoveryQuestionnaireFields,
  discoveryQuestionnaireSections,
  discoveryQuestionnaireSteps,
  type DiscoveryQuestionnaireField,
} from '../../src/lib/discovery/questionnaire-schema';

const expectedApprovedFieldIds = [
  'firstName',
  'lastName',
  'companyClient',
  'industry',
  'email',
  'phone',
  'existingWebsite',
  'projectName',
  'businessDescription',
  'primaryNeed',
  'projectType',
  'projectTypeOther',
  'mainObjectives',
  'targetAudience',
  'targetAudienceOther',
  'desiredUserActions',
  'desiredUserActionsOther',
  'successCriteria',
  'plannedPagesOrSections',
  'availableMaterials',
  'contentResponsibilities',
  'requiredLanguages',
  'requiredLanguagesOther',
  'preferredStyle',
  'preferredStyleOther',
  'coloursAndVisualReferences',
  'referenceWebsites',
  'elementsToAvoid',
  'requestedFeatures',
  'requestedFeaturesOther',
  'domainAndHosting',
  'existingSystems',
  'specialRequirements',
  'preferredStartDate',
  'desiredCompletionDate',
  'importantDeadlinesOrEvents',
  'indicativeBudget',
  'projectPriorities',
  'additionalNotes',
  'pointsRequiringClarification',
  'agreedNextStep',
  'expectedDate',
];

const expectedOptionIds = {
  projectType: [
    'newWebsite',
    'existingWebsiteRedesign',
    'landingPage',
    'webApplication',
    'otherDigitalSolution',
  ],
  availableMaterials: [
    'logoAndBrandIdentity',
    'writtenContent',
    'photographsAndImages',
    'videos',
    'downloadableDocuments',
    'noneAvailable',
  ],
  targetAudience: [
    'privateIndividuals',
    'businessesB2B',
    'professionals',
    'localCustomers',
    'internationalCustomers',
    'other',
  ],
  desiredUserActions: [
    'contactBusiness',
    'requestQuote',
    'bookAppointment',
    'purchaseProduct',
    'registerAccount',
    'subscribeNewsletter',
    'exploreContent',
    'other',
  ],
  requiredLanguages: [
    'english',
    'italian',
    'french',
    'german',
    'spanish',
    'other',
    'notDecidedYet',
  ],
  preferredStyle: [
    'minimalist',
    'modern',
    'corporate',
    'elegantPremium',
    'creative',
    'editorial',
    'technical',
    'other',
    'openToSuggestions',
  ],
  requestedFeatures: [
    'contactForm',
    'blogNews',
    'photoGallery',
    'bookingSystem',
    'newsletter',
    'membersOnlyArea',
    'thirdPartyServiceIntegrations',
    'otherFeatures',
  ],
  domainAndHosting: ['alreadyAvailable', 'toBePurchased', 'toBeConfirmed'],
  indicativeBudget: [
    'under1000',
    '1000To2499',
    '2500To4999',
    '5000To9999',
    '10000OrMore',
    'undecided',
    'preferNotToSay',
  ],
};

function field(id: string): DiscoveryQuestionnaireField {
  const value = discoveryQuestionnaireFields.find((candidate) => candidate.id === id);
  assert.ok(value, `Missing questionnaire field ${id}`);
  return value;
}

async function messages(locale: 'en' | 'it') {
  return JSON.parse(
    await readFile(
      new URL(
        `../../src/messages/${locale}/discoveryQuestionnaire.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    calendar: { formatPlaceholder: string };
    contextualHelp: Record<string, string | Record<string, string>>;
    fields: Record<string, { help?: string; label: string; placeholder?: string }>;
    options: Record<string, Record<string, string>>;
    sections: Record<string, string>;
    steps: Record<string, { description: string; short: string; title: string }>;
  };
}

test('versioned contract covers every approved brief field across eight sections', () => {
  assert.equal(DISCOVERY_QUESTIONNAIRE_VERSION, '2.0');
  assert.deepEqual(approvedBriefFieldIds, expectedApprovedFieldIds);
  assert.deepEqual(
    discoveryQuestionnaireSections.map((section) => section.id),
    ['01', '02', '03', '04', '05', '06', '07', '08'],
  );
  assert.equal(discoveryQuestionnaireFields.at(-1)?.id, 'finalConfirmation');
  assert.equal(discoveryQuestionnaireFields.at(-1)?.source, 'workflow');
  for (const [fieldId, optionIds] of Object.entries(expectedOptionIds)) {
    assert.deepEqual(
      field(fieldId).options?.map((option) => option.id),
      optionIds,
    );
  }
});

test('eight source sections map to the approved seven steps', () => {
  assert.equal(discoveryQuestionnaireSteps.length, 7);
  assert.deepEqual(discoveryQuestionnaireSteps[0].sectionIds, ['01', '02']);
  assert.deepEqual(
    discoveryQuestionnaireSteps.slice(1).map((step) => step.sectionIds),
    [['03'], ['04'], ['05'], ['06'], ['07'], ['08']],
  );
});

test('English and Italian fields, options, sections and steps stay in parity', async () => {
  const [english, italian] = await Promise.all([messages('en'), messages('it')]);
  assert.deepEqual(Object.keys(english.fields), Object.keys(italian.fields));
  assert.deepEqual(Object.keys(english.options), Object.keys(italian.options));
  assert.deepEqual(Object.keys(english.sections), Object.keys(italian.sections));
  assert.deepEqual(Object.keys(english.steps), Object.keys(italian.steps));

  for (const questionnaireField of discoveryQuestionnaireFields as readonly DiscoveryQuestionnaireField[]) {
    assert.ok(english.fields[questionnaireField.id]?.label);
    assert.ok(italian.fields[questionnaireField.id]?.label);
    for (const option of questionnaireField.options ?? []) {
      assert.ok(english.options[questionnaireField.id]?.[option.id]);
      assert.ok(italian.options[questionnaireField.id]?.[option.id]);
    }
  }
  assert.deepEqual(Object.keys(english.contextualHelp), Object.keys(italian.contextualHelp));
});

test('requiredness is limited to approved essential information and confirmation', () => {
  const requiredIds = discoveryQuestionnaireFields
    .filter((questionnaireField) => questionnaireField.required)
    .map((questionnaireField) => questionnaireField.id);
  assert.deepEqual(requiredIds, [
    'firstName',
    'lastName',
    'email',
    'businessDescription',
    'projectType',
    'projectTypeOther',
    'targetAudienceOther',
    'desiredUserActionsOther',
    'requiredLanguagesOther',
    'preferredStyleOther',
    'requestedFeaturesOther',
    'finalConfirmation',
  ]);

  let answers = createDiscoveryQuestionnaireAnswers();
  assert.deepEqual(validateDiscoveryQuestionnaireStep(1, answers), {
    firstName: 'required',
    lastName: 'required',
    email: 'required',
    businessDescription: 'required',
    projectType: 'required',
  });

  answers = updateDiscoveryQuestionnaireAnswer(answers, 'firstName', 'Client');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'lastName', 'Contact');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'email', 'client@example.invalid');
  answers = updateDiscoveryQuestionnaireAnswer(
    answers,
    'businessDescription',
    'A meaningful description with more than twenty characters.',
  );
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'projectType', 'newWebsite');
  assert.deepEqual(validateDiscoveryQuestionnaireStep(1, answers), {});
});

test('conditional Other fields validate only when their option is selected', () => {
  let answers = createDiscoveryQuestionnaireAnswers();
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'firstName', 'Client');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'lastName', 'Person');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'email', 'person@example.invalid');
  answers = updateDiscoveryQuestionnaireAnswer(
    answers,
    'businessDescription',
    'A complete and meaningful business description.',
  );
  answers = updateDiscoveryQuestionnaireAnswer(
    answers,
    'projectType',
    'otherDigitalSolution',
  );
  assert.equal(isDiscoveryQuestionnaireFieldVisible(field('projectTypeOther'), answers), true);
  assert.equal(validateDiscoveryQuestionnaireStep(1, answers).projectTypeOther, 'required');

  answers = updateDiscoveryQuestionnaireAnswer(
    answers,
    'requestedFeatures',
    ['otherFeatures'],
  );
  assert.equal(
    isDiscoveryQuestionnaireFieldVisible(field('requestedFeaturesOther'), answers),
    true,
  );
  assert.equal(
    validateDiscoveryQuestionnaireStep(5, answers).requestedFeaturesOther,
    'required',
  );

  for (const [fieldId, otherId, step] of [
    ['targetAudience', 'targetAudienceOther', 2],
    ['desiredUserActions', 'desiredUserActionsOther', 2],
    ['requiredLanguages', 'requiredLanguagesOther', 3],
    ['preferredStyle', 'preferredStyleOther', 4],
  ] as const) {
    answers = updateDiscoveryQuestionnaireAnswer(answers, fieldId, ['other']);
    assert.equal(isDiscoveryQuestionnaireFieldVisible(field(otherId), answers), true);
    assert.equal(validateDiscoveryQuestionnaireStep(step, answers)[otherId], 'required');
  }
});

test('exclusive structured choices clear concrete selections in both directions', () => {
  for (const [fieldId, concreteOption, exclusiveOption] of [
    ['requiredLanguages', 'english', 'notDecidedYet'],
    ['preferredStyle', 'modern', 'openToSuggestions'],
  ] as const) {
    const questionnaireField = field(fieldId);
    let answers = createDiscoveryQuestionnaireAnswers();
    answers = toggleDiscoveryQuestionnaireOption(
      answers,
      questionnaireField,
      concreteOption,
      true,
    );
    answers = toggleDiscoveryQuestionnaireOption(
      answers,
      questionnaireField,
      exclusiveOption,
      true,
    );
    assert.deepEqual(answers[fieldId], [exclusiveOption]);
    answers = toggleDiscoveryQuestionnaireOption(
      answers,
      questionnaireField,
      concreteOption,
      true,
    );
    assert.deepEqual(answers[fieldId], [concreteOption]);
  }
});

test('trusted invitation prefill initializes editable answers without inventing names', () => {
  const answers = createDiscoveryQuestionnaireAnswers({
    email: 'invited@example.invalid',
  });
  assert.equal(answers.email, 'invited@example.invalid');
  assert.equal(answers.firstName, '');
  assert.equal(answers.lastName, '');

  const edited = updateDiscoveryQuestionnaireAnswer(
    answers,
    'email',
    'edited@example.invalid',
  );
  assert.equal(edited.email, 'edited@example.invalid');
  assert.equal(answers.email, 'invited@example.invalid');
});

test('authenticated prefill uses only invitation-owned email metadata', async () => {
  const [repository, page, entry] = await Promise.all([
    readFile(
      new URL('../../src/lib/discovery/repository-core.ts', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../src/app/[locale]/discovery/page.tsx', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../src/components/discovery/InvitationEntry.tsx', import.meta.url),
      'utf8',
    ),
  ]);
  assert.match(repository, /invitations\.client_email AS invitation_email/u);
  assert.doesNotMatch(repository, /contact\.inquiries/u);
  assert.match(page, /initialPrefill=\{invitationEmail \? \{ email: invitationEmail \}/u);
  assert.match(entry, /window\.location\.replace/u);
});

test('No materials is mutually exclusive with every concrete material', () => {
  const materials = field('availableMaterials');
  let answers = createDiscoveryQuestionnaireAnswers();
  answers = toggleDiscoveryQuestionnaireOption(
    answers,
    materials,
    'logoAndBrandIdentity',
    true,
  );
  answers = toggleDiscoveryQuestionnaireOption(
    answers,
    materials,
    'noneAvailable',
    true,
  );
  assert.deepEqual(answers.availableMaterials, ['noneAvailable']);

  answers = toggleDiscoveryQuestionnaireOption(
    answers,
    materials,
    'writtenContent',
    true,
  );
  assert.deepEqual(answers.availableMaterials, ['writtenContent']);
});

test('answer updates retain values while navigating between step field sets', () => {
  let answers = createDiscoveryQuestionnaireAnswers();
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'projectName', 'Retained project');
  assert.ok(getDiscoveryQuestionnaireStepFields(2, answers).length > 0);
  assert.ok(getDiscoveryQuestionnaireStepFields(7, answers).length > 0);
  assert.equal(answers.projectName, 'Retained project');
});

test('phone input accepts national and pasted international numbers and normalizes to E.164', () => {
  assert.equal(normalizeDiscoveryPhoneNumber('', 'IT'), '');
  assert.equal(
    normalizeDiscoveryPhoneNumber('02 366 18 300', 'IT'),
    '+390236618300',
  );
  assert.equal(
    normalizeDiscoveryPhoneNumber('+44 20 7946 0958', 'IT'),
    '+442079460958',
  );
  assert.equal(phoneAnswerFromInput('020 7946 0958', 'GB'), '+442079460958');
  assert.equal(normalizeDiscoveryPhoneNumber('not-a-number', 'IT'), null);
});

test('website input adds https while preserving valid explicit URLs and components', () => {
  assert.equal(normalizeDiscoveryWebsiteUrl(''), '');
  assert.equal(normalizeDiscoveryWebsiteUrl(' example.com '), 'https://example.com');
  assert.equal(
    normalizeDiscoveryWebsiteUrl('example.com/path?q=1#section'),
    'https://example.com/path?q=1#section',
  );
  assert.equal(
    normalizeDiscoveryWebsiteUrl('http://example.com/path'),
    'http://example.com/path',
  );
  assert.equal(normalizeDiscoveryWebsiteUrl('ftp://example.com'), null);
  assert.equal(normalizeDiscoveryWebsiteUrl('https://https://example.com'), null);
  assert.equal(normalizeDiscoveryWebsiteUrl('https://'), null);
});

test('locale copy includes refined Italian labels and safe CMS and SEO references', async () => {
  const [english, italian] = await Promise.all([messages('en'), messages('it')]);
  assert.equal(italian.fields.successCriteria.label, 'Obiettivi da raggiungere');
  assert.equal(italian.fields.availableMaterials.label, 'Risorse disponibili');
  assert.equal(italian.fields.mainObjectives.label, 'Finalità del progetto');
  assert.equal(
    italian.fields.mainObjectives.help,
    'Quali risultati desideri ottenere con il tuo progetto?',
  );
  assert.equal(english.calendar.formatPlaceholder, 'dd/mm/yyyy');
  assert.equal(italian.calendar.formatPlaceholder, 'gg/mm/aaaa');

  for (const copy of [english, italian]) {
    for (const key of ['existingSystems', 'specialRequirements']) {
      const help = copy.contextualHelp[key];
      assert.equal(typeof help, 'object');
      assert.match((help as Record<string, string>).referenceUrl, /^https:\/\/[a-z]{2}\.wikipedia\.org\/wiki\//u);
    }
  }
});

test('date-only helpers reject invalid dates without timezone serialization', () => {
  assert.equal(formatDiscoveryDateOnly(new Date(2027, 0, 15, 12)), '2027-01-15');
  assert.equal(formatDiscoveryDateDisplay(new Date(2026, 10, 25, 12)), '25/11/2026');
  assert.equal(parseDiscoveryDateOnly('2027-01-15')?.getDate(), 15);
  assert.equal(parseDiscoveryDateDisplay('25/11/2026')?.getMonth(), 10);
  assert.equal(
    formatDiscoveryDateOnly(parseDiscoveryDateDisplay('25/11/2026')!),
    '2026-11-25',
  );
  assert.equal(parseDiscoveryDateDisplay('29/02/2027'), null);
  assert.equal(parseDiscoveryDateDisplay('2027-01-15'), null);
  assert.equal(parseDiscoveryDateOnly('2027-02-29'), null);
  assert.equal(parseDiscoveryDateOnly('15/01/2027'), null);
  assert.equal(parseDiscoveryDateOnly(''), null);

  let answers = createDiscoveryQuestionnaireAnswers();
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'preferredStartDate', '2027-02-29');
  assert.equal(validateDiscoveryQuestionnaireStep(6, answers).preferredStartDate, 'date');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'preferredStartDate', '2027-02-28');
  assert.equal(validateDiscoveryQuestionnaireStep(6, answers).preferredStartDate, undefined);
});

test('invitation-scoped memory state preserves answers, conditional data and progress', () => {
  const store = createDiscoveryQuestionnaireStateStore();
  let answers = createDiscoveryQuestionnaireAnswers({ email: 'invited@example.invalid' });
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'email', 'edited@example.invalid');
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'targetAudience', ['other']);
  answers = updateDiscoveryQuestionnaireAnswer(answers, 'targetAudienceOther', 'Founders');

  store.save({
    answers,
    currentStep: 4,
    highestStepReached: 5,
    phoneCountry: 'GB',
    phoneInput: '020 7946 0958',
    scopeId: 'invitation-a',
  });

  assert.deepEqual(store.read('invitation-a'), {
    answers,
    currentStep: 4,
    highestStepReached: 5,
    phoneCountry: 'GB',
    phoneInput: '020 7946 0958',
    scopeId: 'invitation-a',
  });
  assert.equal(store.read('invitation-b'), null);
  store.clear('invitation-b');
  assert.ok(store.read('invitation-a'));
  store.clear('invitation-a');
  assert.equal(store.read('invitation-a'), null);

  store.save({
    answers,
    currentStep: 2,
    highestStepReached: 2,
    phoneCountry: 'IT',
    phoneInput: '',
    scopeId: 'invitation-c',
  });
  store.clear();
  assert.equal(store.read('invitation-c'), null);
});

test('component preserves accessibility, responsive and no-persistence boundaries', async () => {
  const [source, calendarSource, stateSource, entrySource] = await Promise.all([
    readFile(
      new URL('../../src/components/discovery/DiscoveryQuestionnaire.tsx', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../src/components/discovery/DiscoveryDateInput.tsx', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../src/components/discovery/DiscoveryQuestionnaireState.tsx', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../src/components/discovery/InvitationEntry.tsx', import.meta.url),
      'utf8',
    ),
  ]);
  assert.match(source, /aria-describedby=/u);
  assert.match(source, /aria-invalid=/u);
  assert.match(source, /<fieldset/u);
  assert.match(source, /<legend/u);
  assert.match(source, /role='progressbar'/u);
  assert.match(source, /highestStepReached/u);
  assert.match(source, /disabled=\{!isAvailable\}/u);
  assert.match(source, /<ContextualInfo/u);
  assert.match(source, /<DiscoveryDateInput/u);
  assert.match(source, /formatDiscoveryDateDisplay/u);
  assert.match(source, /section\.id !== '03'/u);
  assert.match(source, /normalizeDiscoveryWebsiteUrl/u);
  assert.match(source, /InternationalPhoneInput/u);
  assert.match(source, /target='_blank'/u);
  assert.match(source, /rel='noreferrer noopener'/u);
  assert.match(source, /referrerPolicy='no-referrer'/u);
  assert.match(source, /sm:grid-cols-2/u);
  assert.match(source, /md:grid-cols-2/u);
  assert.match(source, /motion-reduce:transition-none/u);
  assert.match(source, /disabled\s*\n\s*aria-describedby='discovery-submission-unavailable'/u);
  assert.doesNotMatch(source, /fetch\(/u);
  assert.match(stateSource, /createDiscoveryQuestionnaireStateStore/u);
  assert.match(stateSource, /if \(!isDiscoveryPath\(pathname\)\) store\.clear\(\)/u);
  assert.match(entrySource, /questionnaireState\.clear\(\)/u);
  assert.doesNotMatch(stateSource, /localStorage|sessionStorage/u);
  assert.match(calendarSource, /captionLayout='dropdown'/u);
  assert.match(calendarSource, /weekStartsOn=\{1\}/u);
  assert.match(calendarSource, /onMonthChange=\{setMonth\}/u);
  assert.match(calendarSource, /role='dialog'/u);
  assert.match(calendarSource, /requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\)/u);
  assert.match(calendarSource, /createPortal/u);
  assert.match(calendarSource, /availableBelow < calendar\.scrollHeight/u);
  assert.match(calendarSource, /parseDiscoveryDateDisplay/u);
  assert.doesNotMatch(calendarSource, /toISOString|localStorage|sessionStorage/u);
  assert.equal(source.match(/t\('stepProgress'/gu)?.length, 1);
});
