import React, { forwardRef, useRef } from 'react';

const HISTORY_LIMIT = 100;
const TYPING_GROUP_DELAY = 750;
const GROUPABLE_INPUT_TYPES = new Set([
  'insertText',
  'deleteContentBackward',
  'deleteContentForward',
]);

const snapshotField = (field) => {
  if (field instanceof HTMLSelectElement && field.multiple) {
    return {
      selected: Array.from(field.options, (option) => option.selected),
    };
  }

  if (field instanceof HTMLInputElement
    && (field.type === 'checkbox' || field.type === 'radio')) {
    return { checked: field.checked };
  }

  const snapshot = { value: field.value };
  if (typeof field.selectionStart === 'number') {
    snapshot.selectionStart = field.selectionStart;
    snapshot.selectionEnd = field.selectionEnd;
    snapshot.selectionDirection = field.selectionDirection;
  }
  return snapshot;
};

const sameValue = (left, right) => {
  if (!left || !right) return false;
  if ('checked' in left || 'checked' in right) {
    return left.checked === right.checked;
  }
  if ('selected' in left || 'selected' in right) {
    return JSON.stringify(left.selected) === JSON.stringify(right.selected);
  }
  return left.value === right.value;
};

const snapshotProps = (tagName, props) => {
  if (tagName === 'input'
    && (props.type === 'checkbox' || props.type === 'radio')
    && props.checked !== undefined) {
    return { checked: Boolean(props.checked) };
  }

  if (tagName === 'select' && props.multiple) return null;

  if (props.value !== undefined && props.value !== null) {
    return { value: String(props.value) };
  }
  return null;
};

const restoreField = (field, snapshot) => {
  if ('selected' in snapshot) {
    snapshot.selected.forEach((selected, index) => {
      if (field.options[index]) field.options[index].selected = selected;
    });
  } else if ('checked' in snapshot) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')
      .set.call(field, snapshot.checked);
  } else {
    const prototype = field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')
      .set.call(field, snapshot.value);

    if (typeof field.setSelectionRange === 'function') {
      try {
        field.setSelectionRange(
          snapshot.selectionStart ?? snapshot.value.length,
          snapshot.selectionEnd ?? snapshot.value.length,
          snapshot.selectionDirection,
        );
      } catch {}
    }
  }
};

const createUndoableField = (tagName) => {
  const UndoableField = forwardRef(({
    className = '',
    onChange,
    onFocus,
    onKeyDown,
    onPointerDown,
    ...props
  }, forwardedRef) => {
    const fieldRef = useRef(null);
    const historyRef = useRef(null);
    const applyingRef = useRef(false);
    const hasUserChangesRef = useRef(false);
    const controlledSnapshot = snapshotProps(tagName, props);

    if (!historyRef.current && controlledSnapshot) {
      historyRef.current = {
        entries: [controlledSnapshot],
        index: 0,
        lastInputAt: 0,
        lastInputType: '',
      };
    } else if (
      historyRef.current
      && controlledSnapshot
      && !hasUserChangesRef.current
      && !sameValue(
        historyRef.current.entries[historyRef.current.index],
        controlledSnapshot,
      )
    ) {
      historyRef.current.entries = [controlledSnapshot];
      historyRef.current.index = 0;
    }

    const setRef = (field) => {
      fieldRef.current = field;
      if (typeof forwardedRef === 'function') forwardedRef(field);
      else if (forwardedRef) forwardedRef.current = field;
    };

    const resetHistory = (field) => {
      historyRef.current = {
        entries: [snapshotField(field)],
        index: 0,
        lastInputAt: 0,
        lastInputType: '',
      };
      return historyRef.current;
    };

    const getHistory = (field) => historyRef.current || resetHistory(field);

    const rememberChange = (event) => {
      if (!applyingRef.current) {
        hasUserChangesRef.current = true;
        const history = getHistory(event.currentTarget);
        const next = snapshotField(event.currentTarget);
        const current = history.entries[history.index];

        if (!sameValue(current, next)) {
          const now = Date.now();
          const inputType = event.nativeEvent?.inputType || event.type;
          const canGroupTyping = (
            GROUPABLE_INPUT_TYPES.has(inputType)
            && inputType === history.lastInputType
            && now - history.lastInputAt <= TYPING_GROUP_DELAY
            && history.index === history.entries.length - 1
            && history.index > 0
          );

          if (canGroupTyping) {
            history.entries[history.index] = next;
          } else {
            history.entries.splice(history.index + 1);
            history.entries.push(next);
            if (history.entries.length > HISTORY_LIMIT) history.entries.shift();
            history.index = history.entries.length - 1;
          }

          history.lastInputAt = now;
          history.lastInputType = inputType;
        }
      }

      onChange?.(event);
    };

    const applySnapshot = (field, snapshot) => {
      applyingRef.current = true;
      restoreField(field, snapshot);
      onChange?.({
        target: field,
        currentTarget: field,
        type: 'change',
      });
      applyingRef.current = false;
      field.focus();
    };

    const handleKeyDown = (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.altKey) return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const undoRequested = modifier && key === 'z' && !event.shiftKey;
      const redoRequested = modifier && (
        (key === 'z' && event.shiftKey)
        || (key === 'y' && event.ctrlKey && !event.metaKey)
      );
      if (!undoRequested && !redoRequested) return;

      const field = event.currentTarget;
      const history = getHistory(field);
      const actual = snapshotField(field);
      const recorded = history.entries[history.index];

      if (undoRequested) {
        if (!sameValue(actual, recorded)) {
          event.preventDefault();
          applySnapshot(field, recorded);
          return;
        }
        if (history.index === 0) return;
        event.preventDefault();
        history.index -= 1;
        applySnapshot(field, history.entries[history.index]);
        return;
      }

      if (!sameValue(actual, recorded) || history.index >= history.entries.length - 1) {
        return;
      }
      event.preventDefault();
      history.index += 1;
      applySnapshot(field, history.entries[history.index]);
    };

    const captureInitialValue = (event) => {
      const field = event.currentTarget;
      const history = getHistory(field);
      const actual = snapshotField(field);
      const recorded = history.entries[history.index];
      if (sameValue(actual, recorded)) return;

      history.entries.splice(history.index + 1);
      history.entries.push(actual);
      if (history.entries.length > HISTORY_LIMIT) history.entries.shift();
      history.index = history.entries.length - 1;
      history.lastInputAt = 0;
      history.lastInputType = '';
    };

    return React.createElement(tagName, {
      ...props,
      className: `form-control-text ${className}`.trim(),
      ref: setRef,
      onChange: rememberChange,
      onFocus: (event) => {
        captureInitialValue(event);
        onFocus?.(event);
      },
      onKeyDown: handleKeyDown,
      onPointerDown: (event) => {
        captureInitialValue(event);
        onPointerDown?.(event);
      },
    });
  });

  UndoableField.displayName = `Undoable${tagName[0].toUpperCase()}${tagName.slice(1)}`;
  return UndoableField;
};

export const UndoableInput = createUndoableField('input');
export const UndoableSelect = createUndoableField('select');
export const UndoableTextarea = createUndoableField('textarea');
