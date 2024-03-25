import {StyleHelpers} from './helpers';
import {parse} from './tag-attributes';
import styles from './DjangoFormset.scss';


export abstract class FormDialog {
	protected readonly element: HTMLDialogElement;
	protected readonly formElement: HTMLFormElement;
	private readonly dialogHeaderElement: HTMLElement | null;
	protected readonly induceOpen: Function;
	protected readonly induceClose: Function;
	private readonly baseSelector = 'dialog[is="django-dialog-form"]';
	private dialogRect: DOMRect | null = null;
	private dialogOffsetX: number = 0;
	private dialogOffsetY: number = 0;

	constructor(element: HTMLDialogElement) {
		this.element = element;
		this.formElement = this.element.querySelector('form[method="dialog"]')!;
		if (!this.formElement)
			throw new Error(`${this} requires child <form method="dialog">`);
		this.dialogHeaderElement = this.element.querySelector('.dialog-header');
		if (!StyleHelpers.stylesAreInstalled(this.baseSelector)) {
			this.transferStyles();
		}
		this.induceOpen = this.evalInducer('df-induce-open', () => this.openDialog());
		this.induceClose = this.evalInducer('df-induce-close', (action: string) => this.closeDialog(action));
	}

	protected evalInducer(attr: string, inducer: Function) : Function {
		const attrValue = this.element?.getAttribute(attr);
		if (typeof attrValue !== 'string')
			return () => {};
		try {
			const evalExpression = new Function(`return ${parse(attrValue, {startRule: 'InduceExpression'})}`);
			return (action?: string) => {
				if (evalExpression.call(this)) {
					inducer(action);
				}
			};
		} catch (error) {
			throw new Error(`Error while parsing <dialog ${attr}="${attrValue}">: ${error}.`);
		}
	}

	protected openDialog(){
		if (this.element.open)
			return;
		this.element.show();
		if (this.dialogHeaderElement && !this.dialogRect) {
			this.dialogRect = this.element.getBoundingClientRect();
			this.dialogHeaderElement.addEventListener('pointerdown', this.handlePointerDown);
			this.dialogHeaderElement.addEventListener('touchstart', this.handlePointerDown);
		}
		this.element.addEventListener('close', () => this.closeDialog(), {once: true});
	}

	protected closeDialog(returnValue?: string) {
		this.element.close(returnValue);
	}

	private handlePointerDown = (event: PointerEvent | TouchEvent) => {
		const viewport = window.visualViewport;
		let offsetX: number;
		let offsetY: number;

		const moveDialog = (pointerX: number, pointerY: number) => {
			this.dialogOffsetX = Math.max(pointerX - offsetX, -this.dialogRect!.left);
			this.dialogOffsetY = Math.max(pointerY - offsetY, -this.dialogRect!.top);
			this.dialogOffsetX = Math.min(this.dialogOffsetX, viewport!.width - this.dialogRect!.right);
			this.dialogOffsetY = Math.min(this.dialogOffsetY, viewport!.height - this.dialogRect!.bottom);
			this.element.style.transform = `translate(${this.dialogOffsetX}px, ${this.dialogOffsetY}px)`;
		};
		const handlePointerMove = (pointerMoveEvt: PointerEvent) => {
			moveDialog(pointerMoveEvt.clientX, pointerMoveEvt.clientY);
		};
		const handleTouchMove = (touchMoveEvt: TouchEvent) => {
			touchMoveEvt.preventDefault()
			moveDialog(touchMoveEvt.touches[0].clientX, touchMoveEvt.touches[0].clientY);
		};
		const handlePointerUp = (pointerUpEvt: PointerEvent) => {
			this.dialogHeaderElement!.releasePointerCapture(pointerUpEvt.pointerId);
			this.dialogHeaderElement!.removeEventListener('pointermove', handlePointerMove);
		};
		const handleTouchEnd = (touchEndEvt: TouchEvent) => {
			this.dialogHeaderElement!.removeEventListener('touchmove', handleTouchMove);
		}

		if (event instanceof PointerEvent) {
			offsetX = event.clientX - this.dialogOffsetX;
			offsetY = event.clientY - this.dialogOffsetY;
			this.dialogHeaderElement!.setPointerCapture(event.pointerId);
			this.dialogHeaderElement!.addEventListener('pointermove', handlePointerMove);
			this.dialogHeaderElement!.addEventListener('pointerup', handlePointerUp, {once: true});
		} else {
			offsetX = event.touches[0].clientX - this.dialogOffsetX;
			offsetY = event.touches[0].clientY - this.dialogOffsetY;
			this.dialogHeaderElement!.addEventListener('touchmove', handleTouchMove);
			this.dialogHeaderElement!.addEventListener('touchend', handleTouchEnd, {once: true});
		}
	};

	private transferStyles() {
		const declaredStyles = document.createElement('style');
		declaredStyles.innerText = styles;
		document.head.appendChild(declaredStyles);
		if (!declaredStyles.sheet)
			throw new Error("Could not create <style> element");
	}

	// Hook to be overridden by subclasses.
	// It shall return the aggregated data of the form dialog.
	protected getDataValue(path: Array<string>) : string | null {
		return null;
	}

	// Hook to be overridden by subclasses.
	// path is where in the formset the button is located.
	// It shall return true if the activation button is considered to be pressed.
	protected isButtonActive(path: Array<string>, action: string): boolean {
		return false;
	}

	public updateOperability(action?: string) {
		this.induceOpen(action);
		this.induceClose(action);
	}
}
