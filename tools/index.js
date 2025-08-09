const { business_onboarding_declaration, business_onboarding_runner } = require('./business_onboarding');

const functionDeclarations = [
    business_onboarding_declaration,
    // Add other tool declarations here
];

const toolRunners = {
    business_onboarding: business_onboarding_runner,
    // Add other tool runners here
};

module.exports = {
    functionDeclarations,
    toolRunners,
};