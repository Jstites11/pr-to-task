import { App, Plugin, Notice, TFile } from 'obsidian';

interface PRToTaskSettings {
    githubToken: string;
    prFilter: string;
    taskFilePath: string;
}

const DEFAULT_SETTINGS: PRToTaskSettings = {
    githubToken: '',
    prFilter: 'is:open is:pr author:@me',
    taskFilePath: 'Tasks.md'
}

export default class PRToTaskPlugin extends Plugin {
    settings: PRToTaskSettings;
    async onload() {
        await this.loadSettings();

        // Add a simple command to get PRs
        this.addCommand({
            id: 'get-prs',
            name: 'Get PRs',
            callback: () => {
                this.getPRs();
            }
        });

        // Add settings tab
        this.addSettingTab(new PRToTaskSettingTab(this.app, this));
    }

    onunload() {
        // Clean up resources if needed
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async getPRs() {
        // This is where you would add code to fetch PRs
        // For now, just show a notice

        new Notice('Getting PRs...');
        console.log('Getting PRs with token:', this.settings.githubToken ? 'Token exists' : 'No token');
        console.log('Using PR filter:', this.settings.prFilter);

		// Call the github api to fetch the PR data
		const prData = await this.fetchPRData(this.settings.githubToken, this.settings.prFilter);
		console.log('Received PR data:', prData);
		// Create obsidian task using the fetched dat
		this.createObsidianTasks(prData);
    }

	fetchPRData(token: string, filter: string): Promise<any> {
		// Make a request to the GitHub API for pull requests
		return fetch(`https://api.github.com/search/issues?q=is:pull-request ${filter}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
       .then(response => response.json())
       .then(data => data.items);
    }

	createObsidianTasks(prData: any) {
        // Check if the task file exists
        const taskFile = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
        
        if (!taskFile) {
            console.log('Task file does not exist. Creating it...');
            this.app.vault.create(this.settings.taskFilePath, "# GitHub Pull Requests\n\n").then(() => {
                // After creating the file, add the tasks
                this.appendTasksToFile(prData);
            });
        } else if (taskFile instanceof TFile) {
            // If file exists, append tasks to it
            this.appendTasksToFile(prData);
        } else {
            new Notice('Task file path exists but is not a file');
        }
    }
    
    async appendTasksToFile(prData: any) {
        const taskFile = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
        
        if (taskFile instanceof TFile) {
            // Read existing content
            let tasksContent = ""
            
            // Add each PR as a task
            if (Array.isArray(prData)) {
                for (const pr of prData) {
                    // if PR status is closed, mark the task as completed
                    const isClosed = pr.state === 'closed';
                    const taskLine = `- [${isClosed? 'x' : ' '}] [${pr.title}](${pr.html_url}) #github-pr\n`;
                    tasksContent += taskLine;
                }
            }
            
            // Write back to file
            await this.app.vault.modify(taskFile, tasksContent);
            new Notice('PR tasks added to your task file');
        }
    }
    
}

import { PluginSettingTab, Setting } from 'obsidian';

class PRToTaskSettingTab extends PluginSettingTab {
    plugin: PRToTaskPlugin;

    constructor(app: App, plugin: PRToTaskPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('GitHub Token')
            .setDesc('Enter your GitHub personal access token')
            .addText(text => text
                .setPlaceholder('Enter your GitHub token')
                .setValue(this.plugin.settings.githubToken)
                .onChange(async (value) => {
                    this.plugin.settings.githubToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('PR Filter')
            .setDesc('Enter GitHub search query to filter pull requests (e.g., "is:open is:pr author:@me")')
            .addText(text => text
                .setPlaceholder('is:open is:pr author:@me')
                .setValue(this.plugin.settings.prFilter)
                .onChange(async (value) => {
                    this.plugin.settings.prFilter = value;
                    await this.plugin.saveSettings();
                }));
        
                // add file location setting for where to save tasks

        new Setting(containerEl)
           .setName('File Location')
           .setDesc('Enter the path where you want to save your Obsidian tasks')
           .addText(text => text
                .setPlaceholder('/path/to/tasks.md')
                .setValue(this.plugin.settings.taskFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.taskFilePath = value;
                    await this.plugin.saveSettings();
                }));
    }
}