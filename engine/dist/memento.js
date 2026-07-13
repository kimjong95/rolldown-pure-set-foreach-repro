//#region engine/src/memento.js
function applyRestoreSetForEach(currentProps, targetProps, isEqual) {
	const changedProps = {};
	(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
function applyRestoreSetForOf(currentProps, targetProps, isEqual) {
	const changedProps = {};
	const allKeys = /* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)]);
	for (const key of allKeys) {
		if (key === "text") continue;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	}
	return changedProps;
}
function applyRestoreArrayForEach(currentProps, targetProps, isEqual) {
	const changedProps = {};
	[...Object.keys(currentProps), ...Object.keys(targetProps)].forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
//#endregion
export { applyRestoreArrayForEach, applyRestoreSetForEach, applyRestoreSetForOf };
