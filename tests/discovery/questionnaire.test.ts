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
    contextualHelp: Record<string, string>;
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

test('component preserves accessibility, responsive and no-persistence boundaries', async () => {
  const source = await readFile(
    new URL('../../src/components/discovery/DiscoveryQuestionnaire.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /aria-describedby=/u);
  assert.match(source, /aria-invalid=/u);
  assert.match(source, /<fieldset/u);
  assert.match(source, /<legend/u);
  assert.match(source, /role='progressbar'/u);
  assert.match(source, /highestStepReached/u);
  assert.match(source, /disabled=\{!isAvailable\}/u);
  assert.match(source, /<ContextualInfo/u);
  assert.match(source, /discovery-date-input/u);
  assert.match(source, /sm:grid-cols-2/u);
  assert.match(source, /md:grid-cols-2/u);
  assert.match(source, /motion-reduce:transition-none/u);
  assert.match(source, /disabled\s*\n\s*aria-describedby='discovery-submission-unavailable'/u);
  assert.doesNotMatch(source, /fetch\(/u);
  assert.equal(source.match(/t\('stepProgress'/gu)?.length, 1);
});
