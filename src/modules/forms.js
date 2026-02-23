/**
 * forms.js — Extracts all forms and their submissions from GHL.
 * Endpoints:
 *   GET /forms/              — list forms
 *   GET /forms/submissions   — list submissions per form
 */

import { ghlFetch, ghlFetchAll } from '../ghl-client.js';
import chalk from 'chalk';

export const MODULE_NAME = 'forms';

export async function extract(locationId) {
    // 1. Fetch all forms
    const formsResponse = await ghlFetch('/forms/', { locationId });
    const forms = formsResponse.forms || formsResponse.data || [];

    console.log(chalk.dim(`   📝  Found ${forms.length} forms. Fetching submissions...`));

    // 2. Fetch submissions for each form
    for (const form of forms) {
        try {
            const submissions = await ghlFetchAll('/forms/submissions', {
                locationId,
                formId: form.id,
            }, {
                dataKey: 'submissions',
                limit: 100,
            });
            form.submissions = submissions;
            form.submissionCount = submissions.length;
        } catch (err) {
            console.log(chalk.yellow(`   ⚠  Could not fetch submissions for form "${form.name || form.id}": ${err.message}`));
            form.submissions = [];
            form.submissionCount = 0;
        }
    }

    // 3. Also try to fetch surveys (GHL treats them similarly)
    let surveys = [];
    try {
        const surveysResponse = await ghlFetch('/surveys/', { locationId });
        surveys = surveysResponse.surveys || surveysResponse.data || [];
        console.log(chalk.dim(`   📋  Found ${surveys.length} surveys.`));

        for (const survey of surveys) {
            try {
                const submissions = await ghlFetchAll('/surveys/submissions', {
                    locationId,
                    surveyId: survey.id,
                }, {
                    dataKey: 'submissions',
                    limit: 100,
                });
                survey.submissions = submissions;
                survey.submissionCount = submissions.length;
            } catch (err) {
                survey.submissions = [];
                survey.submissionCount = 0;
            }
        }
    } catch (err) {
        console.log(chalk.yellow(`   ⚠  Could not fetch surveys: ${err.message}`));
    }

    return {
        moduleName: MODULE_NAME,
        count: forms.length,
        surveyCount: surveys.length,
        data: {
            forms,
            surveys,
        },
    };
}
