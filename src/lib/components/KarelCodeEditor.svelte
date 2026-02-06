<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { python } from '@codemirror/lang-python';
	import { EditorState, type Extension } from '@codemirror/state';
	import { Decoration, type DecorationSet } from '@codemirror/view';

	interface Props {
		value: string;
		onchange?: (value: string) => void;
		highlightedLine?: number | null;
		readonly?: boolean;
		class?: string;
	}

	let {
		value = $bindable(''),
		onchange,
		highlightedLine = null,
		readonly = false,
		class: className = ''
	}: Props = $props();

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;

	onMount(() => {
		const extensions: Extension[] = [
			basicSetup,
			python(),
			EditorView.updateListener.of((update) => {
				if (update.docChanged && onchange) {
					const newValue = update.state.doc.toString();
					onchange(newValue);
					value = newValue;
				}
			}),
			EditorView.editable.of(!readonly)
		];

		const startState = EditorState.create({
			doc: value,
			extensions
		});

		editorView = new EditorView({
			state: startState,
			parent: editorContainer
		});
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});

	// Update editor when value changes externally
	$effect(() => {
		if (editorView && value !== editorView.state.doc.toString()) {
			editorView.dispatch({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: value
				}
			});
		}
	});

	// Update readonly state
	$effect(() => {
		if (editorView && readonly !== undefined) {
			// For now, readonly state changes require recreating the editor
			// This is a simplified approach
		}
	});
</script>

<div class="code-editor-wrapper {className}">
	<div bind:this={editorContainer} class="code-editor"></div>
</div>

<style>
	.code-editor-wrapper {
		border: 1px solid #ccc;
		border-radius: 4px;
		overflow: hidden;
	}

	.code-editor {
		height: 100%;
	}

	:global(.cm-editor) {
		height: 100%;
	}

	:global(.cm-scroller) {
		overflow: auto;
	}

	:global(.cm-highlighted-line) {
		background-color: #ffeb3b !important;
	}
</style>
