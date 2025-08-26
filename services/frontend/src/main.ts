/*
/// <reference types="babylonjs" />
*/

import { GameManager, UserManager } from './managers/index.js';
import { InputHandler } from './managers/index.js';
import { RemotePlayerManager } from './managers/index.js';

class Login { // This class handles the whole user login and registration process
	private accountButton;
	private accountModal;
	private closeModal;
	private modalTitle;
	private accountForm;
	private loginBtn;
	private switchToRegister;
	private modalError;
	private isLogin: boolean = true;

	constructor(private userManager: UserManager) { // Constructor takes the UserManager as a parameter
		console.log("init login");
		this.accountButton = document.getElementById('accountButton') as HTMLButtonElement;
		this.accountModal = document.getElementById('accountModal') as HTMLDivElement;
		this.closeModal = document.getElementById('closeModal') as HTMLButtonElement;
		this.modalTitle = document.getElementById('modalTitle') as HTMLHeadingElement;
		this.accountForm = document.getElementById('accountForm') as HTMLFormElement;
		this.loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
		this.switchToRegister = document.getElementById('switchToRegister') as HTMLButtonElement;
		this.modalError = document.getElementById('modalError') as HTMLDivElement;
	}

	public init_registration(): void { // Initialize event listeners for the login/register modal
		this.accountButton.addEventListener('click', this.onAccountButtonClick.bind(this));
		this.closeModal.addEventListener('click', this.onCloseModalClick.bind(this));
		this.switchToRegister.addEventListener('click', this.onSwitchToRegisterClick.bind(this));
		this.accountForm.addEventListener('submit', this.onAccountFormSubmit.bind(this));
	}

	private onAccountButtonClick(): void {
		this.accountModal.style.display = 'block';
		this.modalTitle.textContent = 'Login';
		this.loginBtn.textContent = 'Login';
		this.isLogin = true;
		this.modalError.textContent = '';
	}

	private onCloseModalClick(): void {
		this.accountModal.style.display = 'none';
	}

	private onSwitchToRegisterClick(): void {
		this.isLogin = !this.isLogin;
		if (this.isLogin) {
			this.modalTitle.textContent = 'Login';
			this.loginBtn.textContent = 'Login';
		} else {
			this.modalTitle.textContent = 'Register';
			this.loginBtn.textContent = 'Register';
		}
		this.modalError.textContent = '';
	}

	private async onAccountFormSubmit(event: Event): Promise<void> {
		event.preventDefault();
		const usernameInput = document.getElementById('modalUsername') as HTMLInputElement;
		const passwordInput = document.getElementById('modalPassword') as HTMLInputElement;
		const username = usernameInput.value.trim();
		const password = passwordInput.value.trim();
		if (!username || !password) {
			this.modalError.textContent = 'Username and password are required.';
			return;
		}
		if (this.isLogin) { // Call the login method from UserManager
			const success = await this.userManager.login(username, password);
			if (success) {
				this.accountModal.style.display = 'none';
				alert('Login successful!');
				// From this point we might have a user session used in the chat and game
			} else {
				this.modalError.textContent = 'Login failed. Please check your credentials.';
			}
		} else { // Call the register method from UserManager
			const success = await this.userManager.register(username, 'epicgamer@gmail.com', password);
			if (success) {
				this.accountModal.style.display = 'none';
				alert('Registration successful!');
				// This calls eventually reaches the backend and creates a new user in the database
				// (I hardcoded the email field for now bcs there is no UI for it yet)
			} else {
				this.modalError.textContent = 'Registration failed. Username may already be taken.';
			}
		}
	}
}

class Chat {
    private form;
    private nameInput;
    private chatBox;
    private log;
    private input;
    private sendBtn;

	constructor() {
		console.log("init chat");
		// User management elements
		this.form = document.getElementById('addUserForm') as HTMLFormElement;
		this.nameInput = document.getElementById('userName') as HTMLInputElement;

		// Chat elements
		this.chatBox = document.getElementById('chat') as HTMLDivElement;
		this.log = document.getElementById('log') as HTMLTextAreaElement;
		this.input = document.getElementById('msg') as HTMLInputElement;
		this.sendBtn = document.getElementById('send') as HTMLButtonElement;
	}

	public get_username(): string {
		return this.nameInput ? this.nameInput.value.trim() : '';
	}

	public clear_name_input(): void {
		if (this.nameInput) {
			this.nameInput.value = '';
		}
	}

	public show_chatbox(): void {
		if (this.chatBox) {
			this.chatBox.style.display = 'block';
		}
	}

	public append_log(line: string): void {
		if (this.log) {
			this.log.value += line + '\n';
			this.log.scrollTop = this.log.scrollHeight;
		}
	}

	public get_form(): HTMLFormElement {
		return this.form;
	}

	public send_handler(handler: (message: string) => void): void {
		// Add event listeners to the send button and input field to fire the lambda function when the user clicks the send btn.
		this.sendBtn.addEventListener('click', () => {
			console.log("Send button clicked");
			const message = this.input.value.trim();
			if (message) {
				handler(message);
				this.input.value = '';
			}
		}
		);
		this.input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				console.log("Enter key pressed in input");
				const message = this.input.value.trim();
				if (message) {
					handler(message);
					this.input.value = '';
				}
			}
		}
		);
	}
}

export class App {
	private Chat: Chat;
	private gameManager: GameManager;
	private playerManager?: RemotePlayerManager;
	private userManager: UserManager;
	private Login: Login;

	constructor() {
		// For the UI and chat management and for subscribing to events on the chat (like in Angular)
		this.Chat = new Chat();
		// For the game logic and management
		this.gameManager = new GameManager();
		// For user registration and login
		this.userManager = new UserManager();
		this.Login = new Login(this.userManager);
		this.Login.init_registration();
		// Welcome the user
		console.log('Welcome to the game!');
	}

	private setupChatHandlers(user: { id: number, name: string }): void {
		// Initialize the RemotePlayerManager with the user ID
		this.playerManager = new RemotePlayerManager(user.id);
		// Show the chatbox for a registered user
		this.Chat.show_chatbox();

		// Bind this (append_log) to the user's/subscriber's callback to get fire when a message arrives from the server
		this.playerManager.addCallback((msg: string) => {
			this.Chat.append_log(msg);
		});

		// Set up send handler and bind eventlistener to the send button and input field
		// Fire the lambda function when the user clicks the send button or presses Enter in the input field
		this.Chat.send_handler((msg: string) => {
			console.log(`Sending message: ${msg}`);
			this.playerManager?.send(msg);
			this.Chat.append_log(`Me: ${msg}`);
		})
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new App();
});
