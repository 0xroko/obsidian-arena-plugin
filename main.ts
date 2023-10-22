import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	requestUrl,
} from "obsidian";

const ARENA_DIR = "are.na";
const ARENA_ACCESS_TOKEN_AUTH_URL = "https://arena-rn.vercel.app/api/auth";
const ARENA_CLIENT_ID = "E3-ICKxh6sLQiUqgxvEZI1oFEXXZVeyM-3F146AY3_k";
const ARENA_OAUTH_URL = `http://dev.are.na/oauth/authorize
?client_id=${ARENA_CLIENT_ID}
&redirect_uri=${encodeURIComponent(ARENA_ACCESS_TOKEN_AUTH_URL)}
&response_type=code 
`;

const parseArenaUrl = (url: string) => {
	// block/<id>
	const expr = /block\/(\d+)/;
	const match = url.match(expr);
	if (match) {
		return match[1];
	}
	return null;
};

interface ArenaPluginSettings {
	arenaToken: string | null;
	arenaAccessToken: string | null;
	arenaDir: string;
}

const DEFAULT_SETTINGS: ArenaPluginSettings = {
	arenaAccessToken: null,
	arenaToken: null,
	arenaDir: ARENA_DIR,
};

import { ArenaClient } from "arena-ts";

export default class ArenaPlugin extends Plugin {
	settings: ArenaPluginSettings;
	arenaClient: ArenaClient;

	async fetchAcessToken(code: string) {
		const res = await fetch("https://arena-rn.vercel.app/api/token", {
			body: JSON.stringify({ code }),
			method: "POST",
			mode: "cors",
			credentials: "include",
		});
		const data = await res.json();
		this.settings.arenaAccessToken = data.access_token;
		await this.saveSettings();
	}

	async onload() {
		await this.loadSettings();

		if (this.settings.arenaToken) {
			await this.fetchAcessToken(this.settings.arenaToken);
			this.arenaClient = new ArenaClient({
				token: this.settings.arenaAccessToken,
			});
		}

		this.app.workspace.on("file-menu", (menu, file) => {
			console.log("file-menu", menu, file);
			if (file.parent?.name.includes(ARENA_DIR)) {
				menu.addItem((item) => {
					// open in arena
					item.setTitle("Open in Are.na").onClick(async () => {
						window.open(
							`https://are.na/block/${file.name.split(".")[0]}`
						);
					});
				});
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "insert-area-block",
			name: "Insert Are.na block",
			callback: () => {
				new InsertBlockModal(this.app, async (url) => {
					const id = parseArenaUrl(url);
					if (!id) {
						new Notice("Invalid Are.na url");
						return;
					}
					const block = await this.arenaClient.block(id as any).get();
					let file: TFile | null = null;
					if (block.class === "Image" && block.image) {
						const extension =
							block.image.content_type.split("/")[1];

						const arrayBuffer = await requestUrl(
							block.image.original.url
						).arrayBuffer;

						// save image to attachments folder
						file = await this.app.vault.createBinary(
							`${ARENA_DIR}/${block.id}.${extension}`,
							arrayBuffer
						);
					} else if (block.embed) {
						file = await this.app.vault.create(
							`${ARENA_DIR}/${block.id}.md`,
							`<html>
							 ${block.embed.html}
							</html>
							`
						);
					} else if (block.class === "Text") {
						// save image to attachments folder
						file = await this.app.vault.create(
							`${ARENA_DIR}/${block.id}.md`,
							block.content || ""
						);
					} else if (block.class === "Link") {
						let imgFile: TFile | null = null;
						// also dowload image if it exists
						if (block.image) {
							const extension =
								block.image.content_type.split("/")[1];
							const arrayBuffer = await requestUrl(
								block.image.original.url
							).arrayBuffer;
							imgFile = await this.app.vault.createBinary(
								`${ARENA_DIR}/${block.id}.${extension}`,
								arrayBuffer
							);
						}
						file = await this.app.vault.create(
							`${ARENA_DIR}/${block.id}.md`,
							`[![[${imgFile?.name}]]](${block.source?.url})`
						);
					}

					if (!file) {
						new Notice("Could not create file");
						return;
					}
					const canvasView =
						this.app.workspace.getActiveViewOfType(ItemView);
					if (canvasView?.getViewType() === "canvas") {
						// hot mess since there's no api for this
						const canvas = (canvasView as any)?.canvas as any;
						/*
						new oX(i,(function(e) {
							i.createFileNode({
									pos: t,
									size: n,
									file: e
							})
						}
					*/
						canvas.createFileNode({
							pos: canvas.pointer,
							size: canvas.config.defaultFileNodeDimensions,
							file: file,
						});
					}
				}).open();
			},
		});

		this.addSettingTab(new ArenaSettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class InsertBlockModal extends Modal {
	app: App;
	url: string;
	onSubmit: (blockUrl: string) => void;

	constructor(app: App, onSubmit: (blockUrl: string) => void) {
		super(app);
		this.app = app;
		this.onSubmit = onSubmit;
	}

	blockUrl: string;

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Insert Are.na block" });
		contentEl.createEl("form", {}, (form) => {
			const input = form.createEl("input", {
				placeholder: "https://are.na/block/123",
				type: "text",
			}) as HTMLInputElement;
			input.onchange = (e) => {
				this.url = input.value;
			};
			form.onsubmit = (e) => {
				e.preventDefault();
				this.onSubmit(this.url);
				this.close();
			};
			form.createEl("button", { text: "Submit", cls: "arena-sumbit" });
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

import { BrowserWindow } from "@electron/remote";

class ArenaSettingsTab extends PluginSettingTab {
	plugin: ArenaPlugin;

	constructor(app: App, plugin: ArenaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		console.log(this.plugin.settings.arenaToken);

		if (!this.plugin.settings.arenaToken) {
			new Setting(containerEl)
				.setName("Login with Are.na")
				.setDesc("Login with Are.na to get your api token")
				.addButton((b) =>
					b.setButtonText("Login").onClick(() => {
						const browser = new BrowserWindow({
							width: 600,
							height: 800,
							webPreferences: {
								nodeIntegration: false, // We recommend disabling nodeIntegration for security.
								contextIsolation: true, // We recommend enabling contextIsolation for security.
								// see https://github.com/electron/electron/blob/master/docs/tutorial/security.md
							},
						});

						browser.loadURL(ARENA_OAUTH_URL);

						const {
							session: { webRequest },
						} = browser.webContents;

						webRequest.onBeforeRedirect(async (t) => {
							if (t.redirectURL?.includes("localhost:3000")) {
								const url = new URL(t.redirectURL);
								const code = url.searchParams.get("code");
								console.log(code);
								if (code) {
									this.plugin.settings.arenaToken = code;
									await this.plugin.saveSettings();
								} else {
									console.log("no code");
								}

								browser.close();
							}
						});

						browser.on("closed", () => {
							console.log("window closed");
						});
					})
				);
		} else {
			const tokenCensor =
				this.plugin.settings.arenaToken.slice(0, 4) + "****";
			new Setting(containerEl)
				.setName("Current token")
				.setDesc(tokenCensor)
				.addButton((b) =>
					b.setButtonText("Logout").onClick(async () => {
						this.plugin.settings.arenaToken = null;
						await this.plugin.saveSettings();
					})
				);
		}
	}
}
