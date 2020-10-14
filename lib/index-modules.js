#!/usr/bin/env node
/*
 * Copyright © Bold Brand Commerce Sp. z o.o. All rights reserved.
 * See LICENSE for license details.
 */
const ergonodeAvailableModules = require('@ergonode/available-modules');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const Spinner = require('cli-spinner').Spinner;
const { exec } = require('child_process');
const { throwError } = require('./throw-error');
const packageJson = require('../package');

(async function selectModules() {
    const [ major, minor ] = packageJson.version.split('.');
    const { requiredModules, availableModules } = await ergonodeAvailableModules();

    if(packageJson._availableModules) {
        availableModules.push(
            ...Object.keys(packageJson._availableModules).map((e) => ({
                name: e,
                type: packageJson._availableModules[e],
                version: '1.0.0',
            })),
        );
    }

    if(packageJson._requiredModules) {
        requiredModules.push(...packageJson._requiredModules);
    }

    console.log(chalk.yellow('Select your modules'));

    const options = availableModules.map(({ name, type, version }) => (requiredModules.includes(name)
        ? {
            value: name,
            name: `${name} (${chalk.magenta(type)})[${chalk.blue(`v${version}`)}]`,
            disabled: chalk.red('Required'),
            checked: true,
        }
        : {
            value: name,
            name: `${name} (${chalk.magenta(type)})[${chalk.blue(`v${version}`)}]`,
            checked: true,
        }));
    const { modules } = await inquirer.prompt([
        {
            type: 'checkbox',
            pageSize: 15,
            name: 'modules',
            message: 'Select your modules',
            choices: options,
        },
    ]);
    const selectedModules = [...requiredModules, ...modules];
    const typeModules = type => availableModules.filter(
        m => selectedModules.includes(m.name) && m.type === type,
    );
    const moduleStr = array => array.reduce((acc, module, i) => {
        const tabs = i === 0 ? '' : '\t\t\t\t';
        const enter = i === array.length - 1 ? '' : '\n';

        return `${acc}${tabs}'${module.name || module}',${enter}`;
    }, '');
    const fileStr = `export default {
${requiredModules.length ? `\t\trequired: [\n\t\t\t\t${moduleStr(requiredModules)}\n\t\t],` : ''}
${typeModules('local').length ? `\t\tlocal: [\n\t\t\t\t${moduleStr(typeModules('local'))}\n\t\t],` : ''}
${typeModules('npm').length ? `\t\tnpm: [\n\t\t\t\t${moduleStr(typeModules('npm'))}\n\t\t],` : ''}
};`;

    const moduleInstall = array => array.reduce((acc, module) => `${acc}${module.name || module}@latest `, '');

    fs.writeFile('./modules.config.js', fileStr, (err) => {
      if (err) if (err) throwError(err);
      const spinner = new Spinner(chalk.blue('Installing.. %s'));
      console.log(chalk.green('File created!'));
      console.log(chalk.yellow(`Installing npm modules in ${major}.${minor}.x (latest) version`));
      const installNpm = exec(`npm install ${moduleInstall(typeModules('npm'))}`);

      spinner.setSpinnerString(0);
      spinner.start();

      installNpm.on('exit', () => {
          spinner.stop();
          console.log(chalk.green('\nInstalled!'));
      });
    });
}());
