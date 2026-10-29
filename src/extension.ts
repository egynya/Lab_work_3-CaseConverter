import * as vscode from 'vscode';

/**
 * Множество зарезервированных слов (ключевые слова языков C/C++), 
 * которые не должны изменяться при конвертации текста, чтобы не сломать синтаксис.
 */

export const RESERVED = new Set([
	// C/C++ 
	'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
	'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
	'inline', 'int', 'long', 'register', 'restrict', 'return', 'short',
	'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
	'unsigned', 'void', 'volatile', 'while', 'bool', 'true', 'false',
	'nullptr', 'new', 'delete', 'this', 'class', 'public', 'private',
	'protected', 'virtual', 'override', 'template', 'typename', 'namespace',
	'using', 'try', 'catch', 'throw', 'include', 'define', 'ifdef', 'ifndef', 'endif',

	// Стандартная библиотека C/C++
	'std', 'cout', 'cin', 'cerr', 'endl', 'string', 'vector', 'map', 'set',

	// JavaScript / TypeScript
	'let', 'var', 'function', 'async', 'await', 'yield', 'import', 'export',
	'from', 'default', 'extends', 'super', 'typeof', 'instanceof', 'delete',
	'interface', 'type', 'implements', 'readonly',

	// Java
	'package', 'final', 'boolean', 'String', 'System', 'out', 'println'
]);

/**
 * Получает текущий активный редактор и выделенный пользователем текст.
 * Если редактор не открыт или текст не выделен, выводит сообщение об ошибке.
 * 
 * @returns Объект с редактором (`editor`), диапазоном выделения (`selection`)
 *          и текстом (`selectedText`), либо `null`, если получить данные не удалось.
 */
export function getSelection(): { editor: vscode.TextEditor; selection: vscode.Selection; selectedText: string } | null {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('Нет активного редактора');
		return null;
	}
	const selection = editor.selection;
	const selectedText = editor.document.getText(selection);
	if (!selectedText) {
		vscode.window.showErrorMessage('Требуется выделить текст');
		return null;
	}
	return { editor, selection, selectedText };
}

/**
 * Разбивает строку-идентификатор на массив слов в нижнем регистре.
 * Учитывает разделители (`_`, `-`, `пробел`) и заглавные буквы (случай camelCase).
 * 
 * @param text Исходный идентификатор.
 * @returns Массив слов в нижнем регистре.
 * 
 * @example 
 * splitIntoWords('myVariableName') // вернёт ['my', 'variable', 'name']
 * splitIntoWords('my_var-name') // вернёт ['my', 'var', 'name']
 */

export function splitIntoWords(text: string): string[] {
	const words: string[] = [];
	let current = '';
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === ' ' || char === '_' || char === '-') {
			if (current) {
				words.push(current);
				current = '';
			}
			continue;
		}
		if (i > 0 && char !== char.toLowerCase() && char === char.toUpperCase()) {
			if (current) {
				words.push(current);
				current = '';
			}
		}
		current += char.toLowerCase();

	}
	if (current) {
		words.push(current);
	}
	return words;
}

/**
 * Собирает массив слов в один идентификатор в заданном стиле.
 *
 * @param words Массив слов в нижнем регистре.
 * @param capitalizeFirst Делать ли первую букву первого слова заглавной.
 * @param separator Разделитель между словами (`''`, `_`, `-`).
 * @returns Готовый идентификатор в виде строки.
 * 
 * @example
 * buildFromWords(['my', 'var'], false, '') // вернёт 'myVar' (camelCase)
 * buildFromWords(['my', 'var'], true, '') // вернёт 'MyVar' (PascalCase)
 * buildFromWords(['my', 'var'], false, '_') // вернёт 'my_var' (snake_case)
 * buildFromWords(['my', 'var'], false, '-') // вернёт 'my-var' (kebab-case)
 */

export function buildFromWords(words: string[], capitalizeFirst: boolean, separator: string): string {
	if (words.length === 0) {
		return '';
	}
	const result: string[] = [];
	for (let i = 0; i < words.length; i++) {
		const word = words[i].toLowerCase();
		if (i === 0) {
			if (!capitalizeFirst) {
				result.push(word);
			} else {
				result.push(word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase());
			}
		} else {
			if (separator === '') {
				result.push(word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase());
			} else {
				result.push(word);
			}
		}
	}
	return result.join(separator);
}

/**
 * Временно скрывает (маскирует) строковые литералы и комментарии.
 * Это необходимо, чтобы регулярное выражение при конвертации не изменяло
 * текст внутри кавычек и комментариев.
 * 
 * @param text Исходный код.
 * @returns Объект с замаскированным текстом и массивом оригинальных строк/комментариев.
 * 
 * @example 
 * // Допустим, на вход подали: 'int a = 5; // comment'
 * // Функция вернёт:
 * // {
 * //   maskedText: 'int a = 5; \u00010\u0001', // (здесь \u0001 - невидимый символ)
 * //   originals: ['// comment']
 * // }
 */

export function maskText(text: string) {
	const originals: string[] = [];
	const maskRegex = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')/g;
	const maskedText = text.replace(maskRegex, (match) => {
		const index = originals.length;
		originals.push(match);
		return `\u0001${index}\u0001`;
	});
	return { maskedText, originals };
}

/**
 * Возвращает замаскированные строки и комментарии на их исходные места.
 * 
 * @param text Текст, содержащий маркеры маскировки.
 * @param originals Массив оригинальных строк и комментариев.
 * @returns Текст с восстановленными строками и комментариями.
 * 
 * @example
 * unmaskText('int a = 5; \u00010\u0001', ['// comment'])
 * // вернёт 'int a = 5; // comment'
 */

export function unmaskText(text: string, originals: string[]): string {
	const unmaskRegex = /\u0001(\d+)\u0001/g;
	return text.replace(unmaskRegex, (match, indexStr) => {
		return originals[Number(indexStr)];
	});
}

/**
 * Находит в тексте все идентификаторы (кроме зарезервированных слов)
 * и конвертирует их в заданный стиль.
 * 
 * @param text Текст для обработки (может содержать целый блок кода).
 * @param capitalizeFirst Делать ли первую букву заглавной.
 * @param separator Разделитель между словами.
 * @returns Обработанный текст с изменёнными идентификаторами.
 * 
 * @example
 * // Допустим, на вход подали строку: 'int item_count = 5;'
 * // Вызываем конвертацию в camelCase (capitalizeFirst = false, separator = ''):
 * convertText('int item_count = 5;', false, '');
 * // Вернёт: 'int itemCount = 5;' (слово 'int' не изменилось, так как оно уже находится в RESERVED)
 */

export function convertText(text: string, capitalizeFirst: boolean, separator: string): string {
	// Регулярное выражение ищет идентификаторы, опционально включая дефисы (для kebab-case)
	return text.replace(/[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*/g, (match) => {
		if (RESERVED.has(match)) {
			return match;
		} else {
			return buildFromWords(splitIntoWords(match), capitalizeFirst, separator);
		}
	});
}

/**
 * Точка входа в расширение. Вызывается при активации плагина.
 * Регистрирует четыре команды преобразования текста и добавляет их в подписки.
 * 
 * @param context Контекст расширения VS Code. 
 */

export function activate(context: vscode.ExtensionContext) {
	const disposableCamel = vscode.commands.registerCommand('case-converter.toCamelCase', async () => {
		const data = getSelection();
		if (!data) {
			return;
		}
		const { maskedText, originals } = maskText(data.selectedText);
		const converted = convertText(maskedText, false, '');
		const finalText = unmaskText(converted, originals);
		await data.editor.edit(editBuilder => {
			editBuilder.replace(data.selection, finalText);
		});
	});

	const disposableKebab = vscode.commands.registerCommand('case-converter.toKebabCase', async () => {
		const data = getSelection();
		if (!data) {
			return;
		}
		const { maskedText, originals } = maskText(data.selectedText);
		const converted = convertText(maskedText, false, '-');
		const finalText = unmaskText(converted, originals);
		await data.editor.edit(editBuilder => {
			editBuilder.replace(data.selection, finalText);
		});
	});

	const disposableSnake = vscode.commands.registerCommand('case-converter.toSnakeCase', async () => {
		const data = getSelection();
		if (!data) {
			return;
		}
		const { maskedText, originals } = maskText(data.selectedText);
		const converted = convertText(maskedText, false, '_');
		const finalText = unmaskText(converted, originals);
		await data.editor.edit(editBuilder => {
			editBuilder.replace(data.selection, finalText);
		});
	});

	const disposablePascal = vscode.commands.registerCommand('case-converter.toPascalCase', async () => {
		const data = getSelection();
		if (!data) {
			return;
		}
		const { maskedText, originals } = maskText(data.selectedText);
		const converted = convertText(maskedText, true, '');
		const finalText = unmaskText(converted, originals);
		await data.editor.edit(editBuilder => {
			editBuilder.replace(data.selection, finalText);
		});
	});

	context.subscriptions.push(disposableCamel);
	context.subscriptions.push(disposableKebab);
	context.subscriptions.push(disposableSnake);
	context.subscriptions.push(disposablePascal);
}

/**
 * Точка выхода из расширения. Вызывается при деактивации плагина.
 * В текущей версии ресурсы освобождаются автоматически через `context.subscriptions`.
 */

export function deactivate() { }
