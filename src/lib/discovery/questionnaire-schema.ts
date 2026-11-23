export const DISCOVERY_QUESTIONNAIRE_VERSION = '1.0';

export const discoveryQuestionnaireSteps = [
  { id: 1, sectionIds: ['01', '02'] },
  { id: 2, sectionIds: ['03'] },
  { id: 3, sectionIds: ['04'] },
  { id: 4, sectionIds: ['05'] },
  { id: 5, sectionIds: ['06'] },
  { id: 6, sectionIds: ['07'] },
  { id: 7, sectionIds: ['08'] },
] as const;

export const discoveryQuestionnaireSections = [
  { id: '01', step: 1 },
  { id: '02', step: 1 },
  { id: '03', step: 2 },
  { id: '04', step: 3 },
  { id: '05', step: 4 },
  { id: '06', step: 5 },
  { id: '07', step: 6 },
  { id: '08', step: 7 },
] as const;

export type DiscoveryQuestionnaireSectionId =
  (typeof discoveryQuestionnaireSections)[number]['id'];
export type DiscoveryQuestionnaireStep =
  (typeof discoveryQuestionnaireSteps)[number]['id'];

type QuestionnaireControl =
  | 'checkbox-group'
  | 'date'
  | 'email'
  | 'radio-group'
  | 'select'
  | 'tel'
  | 'text'
  | 'textarea'
  | 'url'
  | 'workflow-confirmation';

type QuestionnaireOption = {
  id: string;
};

export type DiscoveryQuestionnaireField = {
  conditional?: {
    fieldId: string;
    includes?: string;
    value?: string;
  };
  control: QuestionnaireControl;
  exclusiveOptionId?: string;
  id: string;
  minLength?: number;
  options?: readonly QuestionnaireOption[];
  required: boolean;
  sectionId: DiscoveryQuestionnaireSectionId;
  source: 'approved-brief' | 'workflow';
  step: DiscoveryQuestionnaireStep;
};

export const discoveryQuestionnaireFields = [
  {
    id: 'companyClient', sectionId: '01', step: 1, control: 'text', required: true,
    source: 'approved-brief',
  },
  {
    id: 'contactPerson', sectionId: '01', step: 1, control: 'text', required: true,
    source: 'approved-brief',
  },
  {
    id: 'email', sectionId: '01', step: 1, control: 'email', required: true,
    source: 'approved-brief',
  },
  {
    id: 'phone', sectionId: '01', step: 1, control: 'tel', required: false,
    source: 'approved-brief',
  },
  {
    id: 'existingWebsite', sectionId: '01', step: 1, control: 'url', required: false,
    source: 'approved-brief',
  },
  {
    id: 'industry', sectionId: '01', step: 1, control: 'text', required: false,
    source: 'approved-brief',
  },
  {
    id: 'projectName', sectionId: '02', step: 1, control: 'text', required: true,
    source: 'approved-brief',
  },
  {
    id: 'businessDescription', sectionId: '02', step: 1, control: 'textarea',
    required: true, minLength: 20, source: 'approved-brief',
  },
  {
    id: 'primaryNeed', sectionId: '02', step: 1, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'projectType', sectionId: '02', step: 1, control: 'radio-group', required: true,
    source: 'approved-brief',
    options: [
      { id: 'newWebsite' },
      { id: 'existingWebsiteRedesign' },
      { id: 'landingPage' },
      { id: 'webApplication' },
      { id: 'otherDigitalSolution' },
    ],
  },
  {
    id: 'projectTypeOther', sectionId: '02', step: 1, control: 'text', required: true,
    source: 'approved-brief',
    conditional: { fieldId: 'projectType', value: 'otherDigitalSolution' },
  },
  {
    id: 'mainObjectives', sectionId: '03', step: 2, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'targetAudience', sectionId: '03', step: 2, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'desiredUserActions', sectionId: '03', step: 2, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'successCriteria', sectionId: '03', step: 2, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'plannedPagesOrSections', sectionId: '04', step: 3, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'availableMaterials', sectionId: '04', step: 3, control: 'checkbox-group',
    required: false, source: 'approved-brief', exclusiveOptionId: 'noneAvailable',
    options: [
      { id: 'logoAndBrandIdentity' },
      { id: 'writtenContent' },
      { id: 'photographsAndImages' },
      { id: 'videos' },
      { id: 'downloadableDocuments' },
      { id: 'noneAvailable' },
    ],
  },
  {
    id: 'contentResponsibilities', sectionId: '04', step: 3, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'requiredLanguages', sectionId: '04', step: 3, control: 'text', required: false,
    source: 'approved-brief',
  },
  {
    id: 'preferredStyle', sectionId: '05', step: 4, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'coloursAndVisualReferences', sectionId: '05', step: 4, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'referenceWebsites', sectionId: '05', step: 4, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'elementsToAvoid', sectionId: '05', step: 4, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'requestedFeatures', sectionId: '06', step: 5, control: 'checkbox-group',
    required: false, source: 'approved-brief',
    options: [
      { id: 'contactForm' },
      { id: 'blogNews' },
      { id: 'photoGallery' },
      { id: 'bookingSystem' },
      { id: 'newsletter' },
      { id: 'membersOnlyArea' },
      { id: 'thirdPartyServiceIntegrations' },
      { id: 'otherFeatures' },
    ],
  },
  {
    id: 'requestedFeaturesOther', sectionId: '06', step: 5, control: 'text',
    required: true, source: 'approved-brief',
    conditional: { fieldId: 'requestedFeatures', includes: 'otherFeatures' },
  },
  {
    id: 'domainAndHosting', sectionId: '06', step: 5, control: 'radio-group',
    required: false, source: 'approved-brief',
    options: [
      { id: 'alreadyAvailable' },
      { id: 'toBePurchased' },
      { id: 'toBeConfirmed' },
    ],
  },
  {
    id: 'existingSystems', sectionId: '06', step: 5, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'specialRequirements', sectionId: '06', step: 5, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'preferredStartDate', sectionId: '07', step: 6, control: 'date', required: false,
    source: 'approved-brief',
  },
  {
    id: 'desiredCompletionDate', sectionId: '07', step: 6, control: 'date', required: false,
    source: 'approved-brief',
  },
  {
    id: 'importantDeadlinesOrEvents', sectionId: '07', step: 6, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'indicativeBudget', sectionId: '07', step: 6, control: 'select',
    required: false, source: 'approved-brief',
    options: [
      { id: 'under1000' },
      { id: '1000To2499' },
      { id: '2500To4999' },
      { id: '5000To9999' },
      { id: '10000OrMore' },
      { id: 'undecided' },
      { id: 'preferNotToSay' },
    ],
  },
  {
    id: 'projectPriorities', sectionId: '07', step: 6, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'additionalNotes', sectionId: '08', step: 7, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'pointsRequiringClarification', sectionId: '08', step: 7, control: 'textarea',
    required: false, source: 'approved-brief',
  },
  {
    id: 'agreedNextStep', sectionId: '08', step: 7, control: 'textarea', required: false,
    source: 'approved-brief',
  },
  {
    id: 'expectedDate', sectionId: '08', step: 7, control: 'date', required: false,
    source: 'approved-brief',
  },
  {
    id: 'finalConfirmation', sectionId: '08', step: 7, control: 'workflow-confirmation',
    required: true, source: 'workflow',
  },
] as const satisfies readonly DiscoveryQuestionnaireField[];

export type DiscoveryQuestionnaireFieldId =
  (typeof discoveryQuestionnaireFields)[number]['id'];

export const approvedBriefFieldIds = discoveryQuestionnaireFields
  .filter((field) => field.source === 'approved-brief')
  .map((field) => field.id);
