export const buildTokenSettingsMessage = () => {
	const message = document.createDocumentFragment();

	const apiLink = document.createElement("a");
	apiLink.href = "https://dev.are.na/oauth/applications";
	apiLink.target = "_blank";
	apiLink.innerText = "Are.na API";
	message.appendChild(document.createTextNode("Visit "));

	message.appendChild(apiLink);

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

	const instructionsLink = document.createElement("a");

	instructionsLink.href =
		"https://github.com/0xroko/obsidian-arena-plugin#create-your-are.na-personal-access-token";
	instructionsLink.target = "_blank";
	instructionsLink.innerText =
		" creating your Personal Access Token instructions";
	message.appendChild(instructionsLink);

	message.appendChild(
		document.createTextNode(" on how to create Personal Access Token.")
	);

	return message;
};
