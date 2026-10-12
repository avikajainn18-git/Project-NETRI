/// <reference types="vite/client" />
import * as React from "react";

// React 19 (@types/react ≥19) no longer ships a global `JSX` namespace —
// the namespace now lives at `React.JSX`. Re-expose it globally so component
// files may keep typing their return values as `JSX.Element` without
// importing React. Members extend/redelegate React.JSX rather than shadow
// it (an empty global JSX namespace would hide React's element types).
declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementType = React.JSX.ElementType;
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>;
    interface ElementClass extends React.JSX.ElementClass {}
    interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

export {};
