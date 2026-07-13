// Not synthetic. This is a verbatim excerpt from the real compiled output of
// `packages/engine/editor` (`@miri-unicorn/miricanvas-editor-2`) in our
// private monorepo (miridih/miricanvas-web-2), produced by running the
// package's actual `vite build` script (the exact command the real CI
// pipeline runs), on commit 75d9a29505959993f7ec815907ed82a4af6dea38
// (branch release/26.707, 2026-07-13) -- i.e. *before* the fix from
// rolldown/rolldown#10247 was applied.
//
// Output chunk: dist/js/canChangeAllMatchingColor-CV-7ShS4.js
// (the chunk name is a rolldown-assigned hash-based name -- this file just
// happened to be scope-hoisted into that chunk; it has nothing to do with
// color matching).
//
// Nobody wrote the `/* @__PURE__ */` comment below. It is not in our
// source (see ../src/pure-set-foreach.js for the un-annotated original).
// Rolldown inserted it during the package's real production build, and
// positioned it at the head of the `.forEach(...)` chain rather than only
// on `new Set(...)`, exactly as described in the issue.
var applyRestoreSnapshot = (snapshot, nodeManagerInterface) => {
	snapshot.textEntries.forEach(({ nodeId, text: targetText }) => {
		const { node, status } = nodeManagerInterface.getNodeWithStatus(nodeId);
		if (status === NodeStatus.FANOUT_DELETED || !node) return;
		if (!isEqual(node.nodeTextUnit.getNodeText(true), targetText)) node.nodeTextUnit.replaceNodeText(structuredClone(targetText));
	});
	snapshot.propsEntries.forEach(({ nodeId, props: targetProps }) => {
		const { node, status } = nodeManagerInterface.getNodeWithStatus(nodeId);
		if (status === NodeStatus.FANOUT_DELETED || !node) return;
		const currentProps = node.getProps();
		const changedProps = {};
		(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
			if (key === "text") return;
			if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
		});
		if (Object.keys(changedProps).length > 0) node.setProps(changedProps);
	});
	snapshot.floorEntries.forEach(({ nodeId, size: targetSize }) => {
		const { node, status } = nodeManagerInterface.getNodeWithStatus(nodeId);
		if (status === NodeStatus.FANOUT_DELETED || !node) return;
		if (!isEqual(node.textAutoResizeFloorUnit.getFloorSize(), targetSize)) node.textAutoResizeFloorUnit.setFloorSize(targetSize);
	});
};

// IMPORTANT / what this file does *not* show:
// at this package-compile stage the `.forEach(cb)` chain is still present
// and executes normally -- this build step only compiles the package as a
// standalone library, so it has no visibility into how the app that later
// consumes it will (or won't) use `changedProps`. Whether a downstream
// app bundler's minifier goes on to actually delete this chain (as our
// original production regression suggests happened) is a separate,
// *not yet confirmed in isolation* question -- see README "What we have
// NOT proven" section.
