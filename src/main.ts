import { ArenaClient } from "arena-ts";
import {
	App,
	ItemView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	addIcon,
	requestUrl,
} from "obsidian";
import { buildTokenSettingsMessage } from "src/settings/tokenMessage";

// compliant with icon guidelines
addIcon(
	"arena-logo-icon",
	"<path fill='currentColor' d='M48.4699 10.3695C48.7583 8.64812 51.2414 8.64812 51.5298 10.3695L56.0272 37.212C56.1879 38.1711 57.1869 38.7458 58.1008 38.4049L83.6797 28.8645C85.32 28.2527 86.5615 30.3954 85.2096 31.5049L64.1282 48.8071C63.3749 49.4253 63.3749 50.5747 64.1282 51.1929L85.2096 68.4951C86.5615 69.6046 85.32 71.7472 83.6797 71.1354L58.1008 61.595C57.1869 61.2542 56.1879 61.8289 56.0272 62.788L51.5298 89.6305C51.2414 91.3518 48.7583 91.3518 48.4699 89.6305L43.9725 62.788C43.8118 61.8289 42.8128 61.2542 41.8989 61.595L16.32 71.1354C14.6797 71.7472 13.4382 69.6046 14.7901 68.4951L35.8715 51.1929C36.6248 50.5747 36.6248 49.4253 35.8715 48.8071L14.7901 31.5049C13.4382 30.3954 14.6797 28.2527 16.32 28.8645L41.8989 38.4049C42.8128 38.7458 43.8118 38.1711 43.9725 37.212L48.4699 10.3695Z'>"
);

const ARENA_DIR = "are.na";

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
	arenaDir: string;
}

const DEFAULT_SETTINGS: ArenaPluginSettings = {
	arenaToken: null,
	arenaDir: ARENA_DIR,
};

export default class ArenaPlugin extends Plugin {
	settings: ArenaPluginSettings;
	arenaClient: ArenaClient;

	async createFileOrReplace(path: string, data: string) {
		// check if file exists
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && file instanceof TFile) {
			this.app.vault.modify(file, data);
			return file;
		}

		const newFile = await this.app.vault.create(path, data);
		return newFile;
	}

	async createFileOrReplaceBinary(path: string, data: ArrayBuffer) {
		// check if file exists
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && file instanceof TFile) {
			this.app.vault.modifyBinary(file, data);
			return file;
		}

		const newFile = await this.app.vault.createBinary(path, data);
		return newFile;
	}

	async initArenaClient() {
		this.arenaClient = new ArenaClient({
			token: this.settings.arenaToken,
		});
	}

	// main function returns file for further use (e.g. insert into editor)
	async saveBlock(blockId: string) {
		try {
			// @ts-ignore
			const block = await this.arenaClient.block(blockId).get();
			let file: TFile | null = null;
			if (block.class === "Image" && block.image) {
				const extension = block.image.content_type.split("/")[1];

				const arrayBuffer = await requestUrl(block.image.original.url)
					.arrayBuffer;

				// save image to attachments folder
				file = await this.createFileOrReplaceBinary(
					`${ARENA_DIR}/${block.id}.${extension}`,
					arrayBuffer
				);
			} else if (block.embed) {
				file = await this.createFileOrReplace(
					`${ARENA_DIR}/${block.id}.md`,
					`<html>
						${block.embed.html}
					</html>`
				);
			} else if (block.class === "Text") {
				// save image to attachments folder
				file = await this.createFileOrReplace(
					`${ARENA_DIR}/${block.id}.md`,
					block.content || ""
				);
			} else if (block.class === "Link") {
				let imgFile: TFile | null = null;
				// also download image if it exists
				if (block.image) {
					const extension = block.image.content_type.split("/")[1];
					const arrayBuffer = await requestUrl(
						block.image.original.url
					).arrayBuffer;
					imgFile = await this.createFileOrReplaceBinary(
						`${ARENA_DIR}/${block.id}.${extension}`,
						arrayBuffer
					);
				}
				file = await this.createFileOrReplace(
					`${ARENA_DIR}/${block.id}.md`,
					`[![[${imgFile?.name}]]](${block.source?.url})`
				);
			} else if (block.class === "Attachment" && block.attachment) {
				const arrayBuffer = await requestUrl(block.attachment.url)
					.arrayBuffer;
				file = await this.createFileOrReplaceBinary(
					`${ARENA_DIR}/${block.id}.${block.attachment.extension}`,
					arrayBuffer
				);
			}
			if (!file) {
				new Notice("Could not create file");

				return;
			}
			return file;
		} catch (error) {
			if (error.status && error.status === 401) {
				if (!this.settings.arenaToken) {
					new Notice(
						"Following Are.na block requires a personal access token. Please enter one in the settings."
					);
					return null;
				}
				new Notice(
					"Invalid Are.na token, please make sure it's correct."
				);
				return null;
			}
			console.log("Error saving block", error);
			new Notice("Error saving block");
			return null;
		}
	}

	isLogged() {
		// for now true because auth is not needed for getting
		return true;
	}

	isMobile() {
		return Platform.isMobile;
	}

	async loadCommands() {}

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file.parent?.name.includes(ARENA_DIR)) {
					menu.addItem((item) => {
						// open in arena
						item.setTitle("Open in Are.na")
							.onClick(async () => {
								window.open(
									`https://are.na/block/${
										file.name.split(".")[0]
									}`
								);
							})
							.setIcon("arena-logo-icon");
					});
				}
			})
		);

		this.addSettingTab(new ArenaSettingsTab(this.app, this));

		// all of the commands below are are only available on desktop (requires electron APIs)
		if (this.isMobile()) {
			return;
		}

		await this.initArenaClient();

		this.app.workspace.onLayoutReady(async () => {
			const arenaDir = this.app.vault.getAbstractFileByPath(
				this.settings.arenaDir
			);

			if (!arenaDir) {
				await this.app.vault.createFolder(this.settings.arenaDir);
			}
		});

		const checkCallback = (checking: boolean) => {
			if (this.isLogged() && !this.app.workspace.activeEditor) {
				if (!checking) {
					new InsertBlockModal(this.app, async (url) => {
						const id = parseArenaUrl(url);
						if (!id) {
							new Notice("Invalid Are.na url");
							return;
						}

						const file = await this.saveBlock(id);

						if (!file) {
							return;
						}

						const canvasView =
							this.app.workspace.getActiveViewOfType(ItemView);
						if (canvasView?.getViewType() === "canvas") {
							// hot mess since there's no api for this
							const canvas = (canvasView as any)?.canvas;
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
				}
				return true;
			}

			return false;
		};

		this.addCommand({
			id: "insert-arena-block",
			name: "Insert Are.na block",
			checkCallback: checkCallback,
		});

		// editorCheckCallback with this binding
		const editorCheckCallback = (
			checking: boolean,
			editor: { replaceSelection: (arg0: string) => void }
		) => {
			if (this.isLogged()) {
				if (!checking) {
					new InsertBlockModal(this.app, async (url) => {
						const id = parseArenaUrl(url);
						if (!id) {
							new Notice("Invalid Are.na url!");
							return;
						}

						const file = await this.saveBlock(id);

						if (!file) {
							return;
						}

						editor.replaceSelection(`![[${file.name}]]`);
					}).open();
				}
				return true;
			}
			return false;
		};

		this.addCommand({
			id: "insert-arena-block-editor",
			name: "Insert Are.na block (editor)",
			editorCheckCallback: editorCheckCallback,
		});
	}

	onunload() {}

	async logout() {
		this.settings.arenaToken = null;
		await this.saveSettings();
	}

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

class ArenaSettingsTab extends PluginSettingTab {
	plugin: ArenaPlugin;

	constructor(app: App, plugin: ArenaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const message = buildTokenSettingsMessage();

		new Setting(containerEl)
			.setName("Are.na Personal Access Token (optional)")
			.setDesc(message)
			.addText((b) =>
				b
					.setPlaceholder("Paste your Are.na token here")
					.setValue(this.plugin.settings.arenaToken || "")
					.onChange(async (value) => {
						this.plugin.settings.arenaToken = value;
						this.plugin.saveSettings();
						await this.plugin.initArenaClient();
					})
			);
	}
}
