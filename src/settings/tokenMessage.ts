export const createLink = (url: string, text: string) => {
	const link = document.createElement("a");
	link.href = url;
	link.innerText = text;
	link.target = "_blank";
	return link;
};

export const buildTokenSettingsMessage = () => {
	const message = document.createDocumentFragment();

	message.appendChild(
		document.createTextNode(
			"Token is only required for saving private blocks."
		)
	);

	message.appendChild(document.createElement("br"));

	message.appendChild(document.createTextNode("Visit "));

	message.appendChild(
		createLink("https://dev.are.na/oauth/applications", "Are.na API")
	);

	message.appendChild(
		document.createTextNode(" to get your personal access token.")
	);

	message.appendChild(document.createElement("br"));

	message.appendChild(
		document.createTextNode(
			"You will have to create a new application and copy the `Personal Access Token`."
		)
	);

	message.appendChild(document.createElement("br"));

	message.appendChild(
		document.createTextNode("For a detailed guide, check out ")
	);

	message.appendChild(
		createLink(
			"https://github.com/0xroko/obsidian-arena-plugin?tab=readme-ov-file#create-your-arena-personal-access-token",
			"creating your Personal Access Token instructions"
		)
	);

	message.appendChild(
		document.createTextNode(" on how to create Personal Access Token.")
	);

	return message;
};
