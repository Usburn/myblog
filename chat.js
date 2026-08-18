import blessed from 'blessed';

const screen = blessed.screen({
  smartCSR: true,
  title: 'Madbrain TUI v1.0',
});

const logBox = blessed.box({
    top: "0%",
    left: "center",
    width: "100%",
    height: "85%",
    content: "{bold}{yellow-fg}Welcome to the chat robot!{/yellow-fg}{/bold}\nPosez votre question à l'agent...",
    tags: true,
    border: {
        type: 'line'
    },
    style: {
        border: {
            fg: '#f0f0f0'
        }
    }
});

const inputForm = blessed.form({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    inputOnFocus: true,
    border: {
        type: 'line'
    },
    style: {
        border: {
            fg: 'green', border: {fg: 'green'}
        }
    }
});

screen.append(logBox);
screen.append(inputForm);

inputForm.on('submit', async (text) => {
    const question = text.input.value.trim();
    if(!question) return;

    logBox.pushLine(`{bold}{blue-fg}Vous:{/blue-fg}{/bold} ${question}`);
    inputForm.clearValue();
    logBox.pushLine('{gray-fg}L\'agent réfléchit...{/gray-fg}');
    screen.render();

    await new Promise(resolve => setTimeout(resolve, 1000));

    logBox.pushLine(`{bold}{green-fg}Agent:{/green-fg}{/bold} J'ai bien reçu votre demande : "${question}"`);

    inputForm.focus();
    screen.render();
});

screen.key(['escape', 'C-c'], () => process.exit(0));

inputForm.focus();
screen.render();