# Posemirror Guide [url=https://prosemirror.net/docs/guide/]

ProseMirror Guide



[ProseMirror](/)

Contents[Examples](/examples/)
[Documentation](/docs/)
[Discuss](https://discuss.prosemirror.net/)
[GitHub](https://github.com/prosemirror)

* [Introduction](#intro)
* [Documents](#doc)
* [Schemas](#schema)
* [Document transformations](#transform)
* [The editor state](#state)
* [The view component](#view)
* [Commands](#commands)
* [Collaborative editing](#collab)


ProseMirror Guide
=================

This guide describes the various concepts used in the library, and
how they relate to each other. To get a complete picture of the
system, it is recommended to go through it in the order it is
presented in, at least up to the view component section.

Introduction
------------

ProseMirror provides a set of tools and concepts for building rich
text editors, using a user interface inspired by
what-you-see-is-what-you-get, but trying to avoid the pitfalls of that
style of editing.

The main principle of ProseMirror is that your code gets full control
over the document and what happens to it. This document isn't a blob
of HTML, but a custom data structure that only contains elements that
you explicitly allow it to contain, in relations that you specified.
All updates go through a single point, where you can inspect them and
react to them.

The core library is not an easy drop-in component—we are prioritizing
modularity and customizability over simplicity, with the hope that,
in the future, people will distribute drop-in editors based on
ProseMirror. As such, this is more of a Lego set than a Matchbox car.

There are four essential modules, which are required to do any editing at
all, and a number of extension modules maintained by the core team,
which have a status similar to that of 3rd party modules—they provide
useful functionality, but you may omit them or replace them with other
modules that implement similar functionality.

The essential modules are:

* [`prosemirror-model`](/docs/ref/#model) defines the editor's [document
  model](#doc), the data structure used to describe the content
  of the editor.
* [`prosemirror-state`](/docs/ref/#state) provides the data structure that
  describes the editor's whole state, including the selection, and a
  transaction system for moving from one state to the next.
* [`prosemirror-view`](/docs/ref/#view) implements a user interface component
  that shows a given editor state as an editable element in the
  browser, and handles user interaction with that element.
* [`prosemirror-transform`](/docs/ref/#transform) contains functionality for
  modifying documents in a way that can be recorded and replayed,
  which is the basis for the transactions in the `state` module, and
  which makes the undo history and collaborative editing possible.

In addition, there are modules for [basic editing
commands](/docs/ref/#commands), [binding keys](/docs/ref/#keymap), [undo
history](/docs/ref/#history), [input macros](/docs/ref/#inputrules), [collaborative
editing](/docs/ref/#collab), a [simple document schema](/docs/ref/#schema-basic), and
more under the [GitHub prosemirror
organization](https://github.com/prosemirror/).

The fact that ProseMirror isn't distributed as a single,
browser-loadable script means that you'll probably want to use some
kind of bundler when using it. A bundler is a tool that automatically
finds your script's dependencies, and combines them into a single big
file that you can easily load from a web page. You can read more about
bundling on the web, for example
[here](https://medium.freecodecamp.org/javascript-modules-part-2-module-bundling-5020383cf306).

### My first editor

The Lego pieces fit together like this to create a very minimal
editor:

```
import {schema} from "prosemirror-schema-basic"
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"

let state = EditorState.create({schema})
let view = new EditorView(document.body, {state})
```

ProseMirror requires you to specify a schema that your document
conforms to, so the first thing this does is import a module with a
basic schema in it.

That schema is then used to create a state, which will generate an
empty document conforming to the schema, and a default selection at
the start of that document. Finally, a view is created for the state,
and appended to `document.body`. This will render the state's document
as an editable DOM node, and generate state transactions whenever the
user types into it.

The editor isn't very usable yet. If you press enter, for example,
nothing happens, because the core library has no opinion on what enter
should do. We'll get to that in a moment.

### Transactions

When the user types, or otherwise interacts with the view, it
generates ‘state transactions’. What that means is that it does not
just modify the document in-place and implicitly update its state in
that way. Instead, every change causes a
[*transaction*](#state.transactions) to be created, which describes
the changes that are made to the state, and can be applied to create a
*new* state, which is then used to update the view.

By default this all happens under the cover, but you can hook into by
writing [plugins](#state.plugins) or configuring your view. For
example, this code adds a
[`dispatchTransaction`](/docs/ref/#view.DirectEditorProps.dispatchTransaction)
[prop](/docs/ref/#view.EditorProps), which will be called whenever a
transaction is created:

```
// (Imports omitted)

let state = EditorState.create({schema})
let view = new EditorView(document.body, {
  state,
  dispatchTransaction(transaction) {
    console.log("Document size went from", transaction.before.content.size,
                "to", transaction.doc.content.size)
    let newState = view.state.apply(transaction)
    view.updateState(newState)
  }
})
```

*Every* state update has to go through
[`updateState`](/docs/ref/#view.EditorView.updateState), and every normal
editing update will happen by dispatching a transaction.

### Plugins

Plugins are used to extend the behavior of the editor and editor state
in various ways. Some are relatively simple, like the
[keymap](/docs/ref/#keymap) plugin that binds [actions](#commands) to
keyboard input. Others are more involved, like the
[history](/docs/ref/#history) plugin which implements an undo history by
observing transactions and storing their inverse in case the user
wants to undo them.

Let's add those two plugins to our editor to get undo/redo
functionality:

```
// (Omitted repeated imports)
import {undo, redo, history} from "prosemirror-history"
import {keymap} from "prosemirror-keymap"

let state = EditorState.create({
  schema,
  plugins: [
    history(),
    keymap({"Mod-z": undo, "Mod-y": redo})
  ]
})
let view = new EditorView(document.body, {state})
```

Plugins are registered when creating a state (because they get access
to state transactions). After creating a view for this history-enabled
state, you'll be able to press Ctrl-Z (or Cmd-Z on OS X) to undo your
last change.

### Commands

The `undo` and `redo` values that the previous example bound to keys
are a special kind of function called [*commands*](#commands).
Most editing actions are written as commands which can be bound to
keys, hooked up to menus, or otherwise exposed to the user.

The `prosemirror-commands` package provides a number of basic editing
commands, along with a minimal keymap that you'll probably want to
enable to have things like enter and delete do the expected thing in
your editor.

```
// (Omitted repeated imports)
import {baseKeymap} from "prosemirror-commands"

let state = EditorState.create({
  schema,
  plugins: [
    history(),
    keymap({"Mod-z": undo, "Mod-y": redo}),
    keymap(baseKeymap)
  ]
})
let view = new EditorView(document.body, {state})
```

At this point, you have a basically working editor.

To add a menu, additional keybindings for schema-specific things, and
so on, you might want to look into the
[`prosemirror-example-setup`](https://github.com/prosemirror/prosemirror-example-setup)
package. This is a module that provides you with an array of plugins
that set up a baseline editor, but as the name suggests, it is meant
more as an example than as a production-level library. For a
real-world deployment, you'll probably want to replace it with custom
code that sets things up exactly the way you want.

### Content

A state's document lives under its [`doc`](/docs/ref/#state.EditorState.doc)
property. This is a read-only data structure, representing the
document as a hierarchy of nodes, somewhat like the browser DOM. A
simple document might be a `"doc"` node containing two `"paragraph"`
nodes, each containing a single `"text"` node.

When initializing a state, you can give it an initial document to use.
In that case, the `schema` field is optional, since the schema can be
taken from the document.

Here we initialize a state by parsing the content found in the DOM
element with the ID `"content"`, using the DOM parser mechanism, which
uses information supplied by the schema about which DOM nodes map to
which elements in that schema:

```
import {DOMParser} from "prosemirror-model"
import {EditorState} from "prosemirror-state"
import {schema} from "prosemirror-schema-basic"

let content = document.getElementById("content")
let state = EditorState.create({
  doc: DOMParser.fromSchema(schema).parse(content)
})
```

Documents
---------

ProseMirror defines its own [data structure](/docs/ref/#model.Node) to
represent content documents. Since documents are the central element
around which the rest of the editor is built, it is helpful to
understand how they work.

### Structure

A ProseMirror document is a [node](/docs/ref/#model.Node), which holds a
[fragment](/docs/ref/#model.Fragment) containing zero or more child nodes.

This is a lot like the [browser
DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model),
in that it is recursive and tree-shaped. But it differs from the DOM
in the way it stores inline content.

In HTML, a paragraph with markup is represented as a tree, like this:

```
<p>This is <strong>strong text with <em>emphasis</em></strong></p>
```

**p**  
"This is "

**strong**  
"strong text with "

**em**  
"emphasis"

Whereas in ProseMirror, the inline content is modeled as a flat
sequence, with the markup attached as metadata to the nodes:

**paragraph**  

"This is "

"strong text with "  

**strong**

"emphasis"  

**strong**

**em**

This more closely matches the way we tend to think about
and work with such text. It allows us to represent positions in a
paragraph using a character offset rather than a path in a tree, and
makes it easier to perform operations like splitting or changing the
style of the content without performing awkward tree manipulation.

This also means each document has *one* valid representation. Adjacent
text nodes with the same set of marks are always combined together,
and empty text nodes are not allowed. The order in which marks appear
is specified by the schema.

So a ProseMirror document is a tree of block nodes, with most of the
leaf nodes being *textblocks*, which are block nodes that contain
text. You can also have leaf blocks that are simply empty, for example
a horizontal rule or a video element.

Node objects come with a number of properties that reflect the role
they play in the document:

* `isBlock` and `isInline` tell you whether a given node is a block
  or inline node.
* `inlineContent` is true for nodes that expect inline nodes as
  content.
* `isTextblock` is true for block nodes with inline content.
* `isLeaf` tells you that a node doesn't allow any content.

So a typical `"paragraph"` node will be a textblock, whereas a
blockquote might be a block element whose content consists of other
blocks. Text, hard breaks, and inline images are inline leaf nodes,
and a horizontal rule node would be an example of a block leaf node.

The [schema](#schema) is allowed to specify more precise
constraints on what may appear where—i.e. even though a node allows
block content, that doesn't mean that it allows *all* block nodes as
content.

### Identity and persistence

Another important difference between a DOM tree and a ProseMirror
document is the way the objects that represent nodes behave. In the
DOM, nodes are mutable objects with an *identity*, which means that a
node can only appear in one parent node, and that the node object
is mutated when it is updated.

In ProseMirror, on the other hand, nodes are simply *values*, and
should be approached much as you'd approach the value representing the
number 3. 3 can appear in multiple data structures at the same time,
it does not have a parent-link to the data structure it is currently
part of, and if you add 1 to it, you get a *new* value, 4, without
changing anything about the original 3.

So it is with pieces of ProseMirror documents. They don't change, but
can be used as a starting value to compute a modified piece of
document. They don't know what data structures they are part of, but
can be part of multiple structures, or even occur multiple times in a
single structure. They are *values*, not stateful objects.

This means that every time you update a document, you get a new
document value. That document value will share all sub-nodes that
didn't change with the original document value, making it relatively
cheap to create.

This has a bunch of advantages. It makes it impossible to have an
editor in an invalid in-between state during an update, since the new
state, with a new document, can be swapped in instantaneously. It also
makes it easier to reason about documents in a somewhat mathematical
way, which is really hard if your values keep changing underneath you.
This helps make collaborative editing possible and allows ProseMirror
to run a very efficient DOM [update](/docs/ref/#view.EditorView.update)
algorithm by comparing the last document it drew to the screen to the
current document.

Because such nodes are represented by regular JavaScript objects, and
explicitly
[freezing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
their properties hampers performance, it is actually *possible* to
change them. But doing this is not supported, and will cause things to
break, because they are almost always shared between multiple data
structures. So be careful! And note that this also holds for the
arrays and plain objects that are *part* of node objects, such as the
objects used to store node attributes, or the arrays of child nodes in
fragments.

### Data structures

The object structure for a document looks something like this:

|  |
| --- |
| **Node** |
| type: | **NodeType** |
| content: | **Fragment**  [ **Node** , **Node** , ...] |
| attrs: | **Object** |
| marks: | [ |  | | --- | | **Mark** | | type: | **MarkType** | | attrs: | **Object** | , ...] |

Each node is represented by an instance of the [`Node`](/docs/ref/#model.Node)
class. It is tagged with a [type](/docs/ref/#model.NodeType), which knows the
node's name, the attributes that are valid for it, and so on. Node
types (and mark types) are created once per schema, and know which
schema they are part of.

The content of a node is stored in an instance of
[`Fragment`](/docs/ref/#model.Fragment), which holds a sequence of nodes. Even
for nodes that don't have or don't allow content, this field is filled
(with the shared [empty fragment](/docs/ref/#model.Fragment%5Eempty)).

Some node types allow attributes, which are extra values stored with
each node. For example, an image node might use these to store its alt
text and the URL of the image.

In addition, inline nodes hold a set of active marks—things like
emphasis or being a link—which are represented as an array of
[`Mark`](/docs/ref/#model.Mark) instances.

A full document is just a node. The document content is represented as
the top-level node's child nodes. Typically, it'll contain a series of
block nodes, some of which may be textblocks that contain inline
content. But the top-level node may also be a textblock itself, so
that the document contains only inline content.

What kind of node is allowed where is determined by the document's
[schema](#schema). To programmatically create nodes, you must go
through the schema, for example using the
[`node`](/docs/ref/#model.Schema.node) and [`text`](/docs/ref/#model.Schema.text)
methods.

```
import {schema} from "prosemirror-schema-basic"

// (The null arguments are where you can specify attributes, if necessary.)
let doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text("One.")]),
  schema.node("horizontal_rule"),
  schema.node("paragraph", null, [schema.text("Two!")])
])
```

### Indexing

ProseMirror nodes support two types of indexing—they can be treated as
trees, using offsets into individual nodes, or they can be treated as
a flat sequence of tokens.

The first allows you to do things similar to what you'd do with the
DOM—interacting with single nodes, directly accessing child nodes
using the [`child` method](/docs/ref/#model.Node.child) and
[`childCount`](/docs/ref/#model.Node.childCount), writing recursive functions
that scan through a document (if you just want to look at all nodes,
use [`descendants`](/docs/ref/#model.Node.descendants) or
[`nodesBetween`](/docs/ref/#model.Node.nodesBetween)).

The second is more useful when addressing a specific position in the
document. It allows any document position to be represented as an
integer—the index in the token sequence. These tokens don't actually
exist as objects in memory—they are just a counting convention—but the
document's tree shape, along with the fact that each node knows its
size, is used to make by-position access cheap.

* The start of the document, right before the first content, is
  position 0.
* Entering or leaving a node that is not a leaf node (i.e. supports
  content) counts as one token. So if the document starts with a
  paragraph, the start of that paragraph counts as position 1.
* Each character in text nodes counts as one token. So if the
  paragraph at the start of the document contains the word “hi”,
  position 2 is after the “h”, position 3 after the “i”, and position
  4 after the whole paragraph.
* Leaf nodes that do not allow content (such as images) also count as
  a single token.

So if you have a document that, when expressed as HTML, would look
like this:

```
<p>One</p>
<blockquote><p>Two<img src="..."></p></blockquote>
```

The token sequence, with positions, looks like this:

```
0   1 2 3 4    5
 <p> O n e </p>

5            6   7 8 9 10    11   12            13
 <blockquote> <p> T w o <img> </p> </blockquote>
```

Each node has a [`nodeSize`](/docs/ref/#model.Node.nodeSize) property that
gives you the size of the entire node, and you can access
[`.content.size`](/docs/ref/#model.Fragment.size) to get the size of the node's
*content*. Note that for the outer document node, the open and close
tokens are not considered part of the document (because you can't put
your cursor outside of the document), so the size of a document is
`doc.content.size`, **not** `doc.nodeSize`.

Interpreting such positions manually involves quite a lot of counting.
You can call [`Node.resolve`](/docs/ref/#model.Node.resolve) to get a more
descriptive [data structure](/docs/ref/#model.ResolvedPos) for a position. This
data structure will tell you what the parent node of the position is,
what its offset into that parent is, what ancestors the parent has,
and a few other things.

Take care to distinguish between child indices (as per
[`childCount`](/docs/ref/#model.Node.childCount)), document-wide positions, and
node-local offsets (sometimes used in recursive functions to represent
a position into the node that's currently being handled).

### Slices

To handle things like copy-paste and drag-drop, it is necessary to be
able to talk about a slice of document, i.e. the content between two
positions. Such a slice differs from a full node or fragment in that
some of the nodes at its start or end may be ‘open’.

For example, if you select from the middle of one paragraph to the
middle of the next one, the slice you've selected has two paragraphs
in it, the first one open at the start, the second open at the end,
whereas if you node-select a paragraph, you've selected a closed node.
It may be the case that the content in such open nodes violates the
schema constraints, if treated like the node's full content, because
some required nodes fell outside of the slice.

The [`Slice`](/docs/ref/#model.Slice) data structure is used to represent such
slices. It stores a [fragment](/docs/ref/#model.Fragment) along with an [open
depth](/docs/ref/#model.Slice.openStart) on both sides. You can use the
[`slice` method](/docs/ref/#model.Node.slice) on nodes to cut a slice out of a
document.

```
// doc holds two paragraphs, containing text "a" and "b"
let slice1 = doc.slice(0, 3) // The first paragraph
console.log(slice1.openStart, slice1.openEnd) // → 0 0
let slice2 = doc.slice(1, 5) // From start of first paragraph
                             // to end of second
console.log(slice2.openStart, slice2.openEnd) // → 1 1
```

### Changing

Since nodes and fragments are
[persistent](https://en.wikipedia.org/wiki/Persistent_data_structure),
you should **never** mutate them. If you have a handle to a document
(or node, or fragment) that object will stay the same.

Most of the time, you'll use [transformations](#transform) to
update documents, and won't have to directly touch the nodes. These
also leave a record of the changes, which is necessary when the
document is part of an editor state.

In cases where you do want to 'manually' derive an updated document,
there are some helper methods available on the [`Node`](/docs/ref/#model.Node)
and [`Fragment`](/docs/ref/#model.Fragment) types. To create an updated version
of a whole document, you'll usually want to use
[`Node.replace`](/docs/ref/#model.Node.replace), which replaces a given range
of the document with a [slice](/docs/ref/#model.Slice) of new content. To
update a node shallowly, you can use its [`copy`](/docs/ref/#model.Node.copy)
method, which creates a similar node with new content. Fragments also
have various updating methods, such as
[`replaceChild`](/docs/ref/#model.Fragment.replaceChild) or
[`append`](/docs/ref/#model.Fragment.append).

Schemas
-------

Each ProseMirror [document](#doc) has a [schema](/docs/ref/#model.Schema)
associated with it. The schema describes the kind of
[nodes](/docs/ref/#model.Node) that may occur in the document, and the way they
are nested. For example, it might say that the top-level node can
contain one or more blocks, and that paragraph nodes can contain any
number of inline nodes, with any [marks](/docs/ref/#model.Mark) applied to
them.

There is a package with a [basic schema](/docs/ref/#schema-basic) available,
but the nice thing about ProseMirror is that it allows you to define
your own schemas.

### Node Types

Every node in a document has a [type](/docs/ref/#model.NodeType), which
represents its semantic meaning and its properties, such as the way it
is rendered in the editor.

When you define a schema, you enumerate the node types that may occur
within it, describing each with a [spec object](/docs/ref/#model.NodeSpec):

```
const trivialSchema = new Schema({
  nodes: {
    doc: {content: "paragraph+"},
    paragraph: {content: "text*"},
    text: {inline: true},
    /* ... and so on */
  }
})
```

That defines a schema where the document may contain one or more
paragraphs, and each paragraph can contain any amount of text.

Every schema must at least define a top-level node type (which
defaults to the name `"doc"`, but you can
[configure](/docs/ref/#model.Schema.topNodeType) that), and a `"text"` type for
text content.

Nodes that count as inline must declare this with the
[`inline`](/docs/ref/#model.NodeSpec.inline) property (though for the `text`
type, which is inline by definition, you may omit this).

### Content Expressions

The strings in the [`content`](/docs/ref/#model.NodeSpec.content) fields in the
example schema above are called *content expressions*. They control
what sequences of child nodes are valid for this node type.

You can say, for example `"paragraph"` for “one paragraph”, or
`"paragraph+"` to express “one or more paragraphs”. Similarly,
`"paragraph*"` means “zero or more paragraphs” and `"caption?"` means
“zero or one caption node”. You can also use regular-expression-like
ranges, such as `{2}` (“exactly two”) `{1, 5}` (“one to five”) or
`{2,}` (“two or more”) after node names.

Such expressions can be combined to create a sequence, for example
`"heading paragraph+"` means ‘first a heading, then one or more
paragraphs’. You can also use the pipe `|` operator to indicate a
choice between two expressions, as in `"(paragraph | blockquote)+"`.

Some groups of element types will appear multiple times in your
schema—for example you might have a concept of “block” nodes, that may
appear at the top level but also nested inside of blockquotes. You can
create a node group by giving your node specs a
[`group`](/docs/ref/#model.NodeSpec.group) property, and then refer to that
group by its name in your expressions.

```
const groupSchema = new Schema({
  nodes: {
    doc: {content: "block+"},
    paragraph: {group: "block", content: "text*"},
    blockquote: {group: "block", content: "block+"},
    text: {}
  }
})
```

Here `"block+"` is equivalent to `"(paragraph | blockquote)+"`.

It is recommended to always require at least one child node in nodes
that have block content (such as `"doc"` and `"blockquote"` in the
example above), because browsers will completely collapse the node
when it's empty, making it rather hard to edit.

The order in which your nodes appear in an or-expression is
significant. When creating a default instance for a non-optional node,
for example to make sure a document still conforms to the schema after
a [replace step](/docs/ref/#transform.ReplaceStep) the first type in the
expression will be used. If that is a group, the first type in the
group (determined by the order in which the group's members appear in
your `nodes` map) is used. If I switched the positions of
`"paragraph"` and `"blockquote"` in the the example schema, you'd get
a stack overflow as soon as the editor tried to create a block
node—it'd create a `"blockquote"` node, whose content requires at
least one block, so it'd try to create another `"blockquote"` as
content, and so on.

Not every node-manipulating function in the library checks that it is
dealing with valid content—higher level concepts like
[transforms](#transform) do, but primitive node-creation methods
usually don't and instead put the responsibility for providing sane
input on their caller. It is perfectly possible to use, for example
[`NodeType.create`](/docs/ref/#model.NodeType.create), to create a node with
invalid content. For nodes that are ‘open’ on the edge of
[slices](#doc.slices), this is even a reasonable thing to do. There
is a separate [`createChecked`
method](/docs/ref/#model.NodeType.createChecked), as well as an after-the-fact
[`check` method](/docs/ref/#model.Node.check) that can be used to assert that a
given node's content is valid.

### Marks

Marks are used to add extra styling or other information to inline
content. A schema must declare all mark types it allows in its
[schema](/docs/ref/#model.Schema). [Mark types](/docs/ref/#model.MarkType) are objects
much like node types, used to tag mark objects and provide additional
information about them.

By default, nodes with inline content allow all marks defined in the
schema to be applied to their children. You can configure this with
the [`marks`](/docs/ref/#model.NodeSpec.marks) property on your node spec.

Here's a simple schema that supports strong and emphasis marks on
text in paragraphs, but not in headings:

```
const markSchema = new Schema({
  nodes: {
    doc: {content: "block+"},
    paragraph: {group: "block", content: "text*", marks: "_"},
    heading: {group: "block", content: "text*", marks: ""},
    text: {inline: true}
  },
  marks: {
    strong: {},
    em: {}
  }
})
```

The set of marks is interpreted as a space-separated string of mark
names or mark groups—`"_"` acts as a wildcard, and the empty string
corresponds to the empty set.

### Attributes

The document schema also defines which *attributes* each node or mark
has. If your node type requires extra node-specific information to be
stored, such as the level of a heading node, that is best done with an
attribute.

Attribute sets are represented as plain objects with a predefined (per
node or mark) set of properties holding any JSON-serializeable values.
To specify what attributes it allows, use the optional `attrs` field
in a node or mark spec.

```
  heading: {
    content: "text*",
    attrs: {level: {default: 1}}
  }
```

In this schema, every instance of the `heading` node will have a
`level` attribute under `.attrs.level`. If it isn't specified when the
node is [created](/docs/ref/#model.NodeType.create), it will default to 1.

When you don't give a default value for an
attribute, an error will be raised when you attempt to create such a
node without specifying that attribute.

That will also make it impossible for the library to generate such
nodes as filler to satisfy schema constraints during a transform or
when calling [`createAndFill`](/docs/ref/#model.NodeType.createAndFill). This
is why you are not allowed to put such nodes in a required position in
the schema—in order to be able to enforce the schema constraints, the
editor needs to be able to generate empty nodes to fill missing pieces
in the content.

### Serialization and Parsing

In order to be able to edit them in the browser, it must be possible
to represent document nodes in the browser DOM. The easiest way to do
that is to include information about each node's DOM representation in
the schema using the [`toDOM` field](/docs/ref/#model.NodeSpec.toDOM) in the
node spec.

This field should hold a function that, when called with the node as
argument, returns a description of the DOM structure for that node.
This may either be a direct DOM node or an [array describing
it](/docs/ref/#model.DOMOutputSpec), for example:

```
const schema = new Schema({
  nodes: {
    doc: {content: "paragraph+"},
    paragraph: {
      content: "text*",
      toDOM(node) { return ["p", 0] }
    },
    text: {}
  }
})
```

The expression `["p", 0]` declares that a paragraph is rendered as an
HTML `<p>` tag. The zero is the ‘hole’ where its content should be
rendered. You may also include an object with HTML attributes after
the tag name, for example `["div", {class: "c"}, 0]`. Leaf nodes don't
need a hole in their DOM representation, since they don't have
content.

Mark specs allow a similar [`toDOM`](/docs/ref/#model.MarkSpec.toDOM) method,
but they are required to render as a single tag that directly wraps
the content, so the content always goes directly in the returned node,
and the hole doesn't need to be specified.

You'll also often need to *parse* a document from DOM data, for
example when the user pastes or drags something into the editor. The
model module also comes with functionality for that, and you are
encouraged to include parsing information directly in your schema with
the [`parseDOM` property](/docs/ref/#model.NodeSpec.parseDOM).

This may list an array of [*parse rules*](/docs/ref/#model.ParseRule), which
describe DOM constructs that map to a given node or mark. For example,
the basic schema has these for the emphasis mark:

```
  parseDOM: [
    {tag: "em"},                 // Match <em> nodes
    {tag: "i"},                  // and <i> nodes
    {style: "font-style=italic"} // and inline 'font-style: italic'
  ]
```

The value given to [`tag`](/docs/ref/#model.ParseRule.tag) in a parse rule can
be a CSS selector, so you can do thing like `"div.myclass"` too.
Similarly, [`style`](/docs/ref/#model.ParseRule.style) matches inline CSS
styles.

When a schema includes `parseDOM` annotations, you can create a
[`DOMParser`](/docs/ref/#model.DOMParser) object for it with
[`DOMParser.fromSchema`](/docs/ref/#model.DOMParser%5EfromSchema). This is done
by the editor to create the default clipboard parser, but you can
also [override](/docs/ref/#view.EditorProps.clipboardParser) that.

Documents also come with a built-in JSON serialization format. You can
call [`toJSON`](/docs/ref/#model.Node.toJSON) on them to get an object that can
safely be passed to
[`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify),
and schema objects have a [`nodeFromJSON` method](/docs/ref/#model.Schema.nodeFromJSON)
that can parse this representation back into a document.

### Extending a schema

The `nodes` and `marks` options passed to the [`Schema`
constructor](/docs/ref/#model.Schema) take [`OrderedMap`
objects](https://github.com/marijnh/orderedmap#readme) as well as
plain JavaScript objects. The resulting schema's
[`spec`](/docs/ref/#model.Schema.spec)`.nodes` and `spec.marks` properties are
always `OrderedMap`s, which can be used as the basis for further
schemas.

Such maps support a number of methods to conveniently create updated
versions. For example you could say
`schema.spec.nodes.remove("blockquote")` to derive a set of nodes
without the `blockquote` node, which can then be passed as the `nodes`
field for a new schema.

The [schema-list](/docs/ref/#schema-list) module exports a [convenience
method](/docs/ref/#schema-list.addListNodes) to add the nodes exported by those
modules to a nodeset.

Document transformations
------------------------

[Transforms](/docs/ref/#transform.Transform) are central to the way ProseMirror
works. They form the basis for [transactions](#state.transactions),
and are what makes history tracking and collaborative editing
possible.

### Why?

Why can't we just mutate the document and be done with it? Or at least
create a new version of a document and just put that into the editor?

There are several reasons. One is code clarity. Immutable data
structures really do lead to simpler code. But the main thing the
transform system does is to leave a *trail* of updates, in the form of
values that represent the individual steps taken to go from an old
version of the document to a new one.

The [undo history](/docs/ref/#history) can save these steps and apply their
inverse to go back in time (ProseMirror implements selective undo,
which is more complicated than just rolling back to a previous state).

The [collaborative
editing](http://marijnhaverbeke.nl/blog/collaborative-editing.html)
system sends these steps to other editors and reorders them if
necessary so that everyone ends up with the same document.

More generally, it is very useful for editor plugins to be able to
inspect and react to each change as it comes in, in order to keep
their own state consistent with the rest of the editor state.

### Steps

Updates to documents are decomposed into [steps](/docs/ref/#transform.Step)
that describe an update. You usually don't need to work with these
directly, but it is useful to know how they work.

Examples of steps are [`ReplaceStep`](/docs/ref/#transform.ReplaceStep) to
replace a piece of a document, or
[`AddMarkStep`](/docs/ref/#transform.AddMarkStep) to add a mark to a given
range.

A step can be [applied](/docs/ref/#transform.Step.apply) to a document to
produce a new document.

```
console.log(myDoc.toString()) // → p("hello")
// A step that deletes the content between positions 3 and 5
let step = new ReplaceStep(3, 5, Slice.empty)
let result = step.apply(myDoc)
console.log(result.doc.toString()) // → p("heo")
```

Applying a step is a relatively straightforward process—it doesn't do
anything clever like inserting nodes to preserve schema constraints,
or transforming the slice to make it fit. That means applying a step
can fail, for example if you try to delete just the opening token of a
node, that would leave the tokens unbalanced, which isn't a meaningful
thing you can do. This is why [`apply`](/docs/ref/#transform.Step.apply)
returns a [result object](/docs/ref/#transform.StepResult), which holds either
a new document, *or* an error message.

You'll usually want to let [helper
functions](/docs/ref/#transform.Transform.replace) generate your steps for you,
so that you don't have to worry about the details.

### Transforms

An editing action may produce one or more steps. The most convenient
way to work with a sequence of steps is to create a [`Transform`
object](/docs/ref/#transform.Transform) (or, if you're working with a full
editor state, a [`Transaction`](/docs/ref/#state.Transaction), which is a
subclass of `Transform`).

```
let tr = new Transform(myDoc)
tr.delete(5, 7) // Delete between position 5 and 7
tr.split(5)     // Split the parent node at position 5
console.log(tr.doc.toString()) // The modified document
console.log(tr.steps.length)   // → 2
```

Most transform methods return the transform itself, for convenient
chaining (allowing you to do `tr.delete(5, 7).split(5)`).

There are transform methods for
[deleting](/docs/ref/#transform.Transform.delete) and
[replacing](/docs/ref/#transform.Transform.replace), for
[adding](/docs/ref/#transform.Transform.addMark) and [removing
marks](/docs/ref/#transform.Transform.removeMark), for performing tree
manipulation like [splitting](/docs/ref/#transform.Transform.split),
[joining](/docs/ref/#transform.Transform.join),
[lifting](/docs/ref/#transform.Transform.lift), and
[wrapping](/docs/ref/#transform.Transform.wrap), and more.

### Mapping

When you make a change to a document, positions pointing into that
document may become invalid or change meaning. For example, if you
insert a character, all positions after that character now point one
token before their old position. Similarly, if you delete all the
content in a document, all positions pointing into that content are
now invalid.

We often do need to preserve positions across document changes, for
example the selection boundaries. To help with this, steps can give
you a [*map*](/docs/ref/#transform.StepMap) that can convert between positions
in the document before and after applying the step.

```
let step = new ReplaceStep(4, 6, Slice.empty) // Delete 4-5
let map = step.getMap()
console.log(map.map(8)) // → 6
console.log(map.map(2)) // → 2 (nothing changes before the change)
```

Transform objects automatically
[accumulate](/docs/ref/#transform.Transform.mapping) a set of maps for the
steps in them, using an abstraction called
[`Mapping`](/docs/ref/#transform.Mapping), which collects a series of step maps
and allows you to map through them in one go.

```
let tr = new Transform(myDoc)
tr.split(10)    // split a node, +2 tokens at 10
tr.delete(2, 5) // -3 tokens at 2
console.log(tr.mapping.map(15)) // → 14
console.log(tr.mapping.map(6))  // → 3
console.log(tr.mapping.map(10)) // → 9
```

There are cases where it's not entirely clear what a given position
should be mapped to. Consider the last line of the example above.
Position 10 points precisely at the point where we split a node,
inserting two tokens. Should it be mapped to the position *after* the
inserted content, or stay in front of it? In the example, it is
apparently moved after the inserted tokens.

But sometimes you want the other behavior, which is why the [`map`
method](/docs/ref/#transform.Mappable.map) on step maps and mappings accepts a
second parameter, `bias`, which you can set to -1 to keep your
position in place when content is inserted on top of it.

```
console.log(tr.mapping.map(10, -1)) // → 7
```

The reason that individual steps are defined as small, straightforward
things is that it makes this kind of mapping possible, along with
[inverting](/docs/ref/#transform.Step.invert) steps in a lossless way, and
mapping steps through each other's position maps.

### Rebasing

When doing more complicated things with steps and position maps, for
example to implement your own change tracking, or to integrate some
feature with collaborative editing, you might run into the need to
*rebase* steps.

You might not want to bother studying this until you are sure you need
it.

Rebasing, in the simple case, is the process of taking two steps that
start with the same document, and transform one of them so that it can
be applied to the document created by the other instead. In pseudocode:

```
stepA(doc) = docA
stepB(doc) = docB
stepB(docA) = MISMATCH!
rebase(stepB, mapA) = stepB'
stepB'(docA) = docAB
```

Steps have a [`map` method](/docs/ref/#transform.Step.map), which, given a
mapping, maps the whole step through it. This can fail, since some
steps don't make sense anymore when, for example, the content they
applied to has been deleted. But when it succeeds, you now have a step
pointing into a new document, i.e. the one after the changes that you
mapped through. So in the above example, `rebase(stepB, mapA)` can
simply call `stepB.map(mapA)`.

Things get more complicated when you want to rebase a chain of steps
over another chain of steps.

```
stepA2(stepA1(doc)) = docA
stepB2(stepB1(doc)) = docB
???(docA) = docAB
```

We can map `stepB1` over `stepA1` and then `stepA2`, to get `stepB1'`.
But with `stepB2`, which starts at the document produced by
`stepB1(doc)`, and whose mapped version must apply to the document
produced by `stepB1'(docA)`, things get more difficult. It must be
mapped over the following chain of maps:

```
rebase(stepB2, [invert(mapB1), mapA1, mapA2, mapB1'])
```

I.e. first the inverse of the map for `stepB1` to get back to the
original document, then through the pipeline of maps produced by
applying `stepA1` and `stepA2`, and finally through the map produced
by applying `stepB1'` to `docA`.

If there was a `stepB3`, we'd get the pipeline for that one by taking
the one above, prefixing it with `invert(mapB2)` and adding `mapB2'`
to the end. And so on.

But when `stepB1` inserted some content, and `stepB2` did something to
that content, then mapping `stepB2` through `invert(mapB1)` will
return `null`, because the inverse of `stepB1` *deletes* the content
to which it applies. However, this content is reintroduced later in
the pipeline, by `mapB1`. The [`Mapping`](/docs/ref/#transform.Mapping)
abstraction provides a way to track such pipelines, including the
inverse relations between the maps in it. You can map steps through it
in such a way that they survive situations like the one above.

Even if you have rebased a step, there is no guarantee that it can
still be validly applied to the current document. For example, if your
step adds a mark, but another step changed the parent node of your
target content to be a node that doesn't allow marks, trying to apply
your step will fail. The appropriate response to this is usually just
to drop the step.

The editor state
----------------

What makes up the state of an editor? You have your document, of
course. And also the current selection. And there needs to be a way to
store the fact that the current set of marks has changed, when you for
example disable or enable a mark but haven't started typing with that
mark yet.

Those are the three main components of a ProseMirror state, and exist
on state objects as [`doc`](/docs/ref/#state.EditorState.doc),
[`selection`](/docs/ref/#state.EditorState.selection), and
[`storedMarks`](/docs/ref/#state.EditorState.storedMarks).

```
import {schema} from "prosemirror-schema-basic"
import {EditorState} from "prosemirror-state"

let state = EditorState.create({schema})
console.log(state.doc.toString()) // An empty paragraph
console.log(state.selection.from) // 1, the start of the paragraph
```

But plugins may also need to store state—for example, the undo history
has to keep its history of changes. This is why the set of active
plugins is also stored in the state, and these plugins can define
additional slots for storing their own state.

### Selection

ProseMirror supports several types of selection (and allows 3rd-party
code to define new selection types). Selections are represented by
instances of (subclasses of) the [`Selection`](/docs/ref/#state.Selection)
class. Like documents and other state-related values, they are
immutable—to change the selection, you create a new selection object
and a new state to hold it.

Selections have, at the very least, a start
([`.from`](/docs/ref/#state.Selection.from)) and an end
([`.to`](/docs/ref/#state.Selection.to)), as positions pointing into the
current document. Many selection types also distinguish between the
[*anchor*](/docs/ref/#state.Selection.anchor) (unmoveable) and
[*head*](/docs/ref/#state.Selection.head) (moveable) side of the selection, so
those are also required to exist on every selection object.

The most common type of selection is a [text
selection](/docs/ref/#state.TextSelection), which is used for regular cursors
(when `anchor` and `head` are the same) or selected text. Both
endpoints of a text selection are required to be in inline positions,
i.e. pointing into nodes that allow inline content.

The core library also supports [node
selections](/docs/ref/#state.NodeSelection), where a single document node is
selected, which you get, for example, when you ctrl/cmd-click a node.
Such a selection ranges from the position directly before the node to
the position directly after it.

### Transactions

During normal editing, new states will be derived from the state
before them. You may in some situations, such as loading a new
document, want to create a completely new state, but this is the
exception.

State updates happen by [applying](/docs/ref/#state.EditorState.apply) a
[transaction](/docs/ref/#state.Transaction) to an existing state, producing a
new state. Conceptually, they happen in a single shot: given the old
state and the transaction, a new value is computed for each component
of the state, and those are put together in a new state value.

```
let tr = state.tr
console.log(tr.doc.content.size) // 25
tr.insertText("hello") // Replaces selection with 'hello'
let newState = state.apply(tr)
console.log(tr.doc.content.size) // 30
```

[`Transaction`](/docs/ref/#state.Transaction) is a subclass of
[`Transform`](/docs/ref/#transform.Transform), and inherits the way it builds
up a new document by applying [steps](/docs/ref/#transform.Step) to an initial
document. In addition to this, transactions track selection and other
state-related components, and get some selection-related convenience
methods such as
[`replaceSelection`](/docs/ref/#state.Transaction.replaceSelection).

The easiest way to create a transaction is with the [`tr`
getter](/docs/ref/#state.EditorState.tr) on an editor state object. This
creates an empty transaction based on that state, to which you can
then add steps and other updates.

By default, the old selection is [mapped](/docs/ref/#state.Selection.map)
through each step to produce a new selection, but it is possible to
use [`setSelection`](/docs/ref/#state.Transaction.setSelection) to explicitly
set a new selection.

```
let tr = state.tr
console.log(tr.selection.from) // → 10
tr.delete(6, 8)
console.log(tr.selection.from) // → 8 (moved back)
tr.setSelection(TextSelection.create(tr.doc, 3))
console.log(tr.selection.from) // → 3
```

Similarly, the [set of active marks](/docs/ref/#state.EditorState.storedMarks)
is automatically cleared after a document or selection change, and can
be set using the
[`setStoredMarks`](/docs/ref/#state.Transaction.setStoredMarks) or
[`ensureMarks`](/docs/ref/#state.Transaction.ensureMarks) methods.

Finally, the [`scrollIntoView`](/docs/ref/#state.Transaction.scrollIntoView)
method can be used to ensure that, the next time the state is drawn,
the selection is scrolled into view. You probably want to do that for
most user actions.

Like `Transform` methods, many `Transaction` methods return the
transaction itself, for convenient chaining.

### Plugins

When [creating](/docs/ref/#state.EditorState%5Ecreate) a new state, you can
provide an array of plugins to use. These will be stored in the state
and any state that is derived from it, and can influence both the way
transactions are applied and the way an editor based on this state
behaves.

Plugins are instances of the [`Plugin` class](/docs/ref/#state.Plugin), and can
model a wide variety of features. The simplest ones just add some
[props](/docs/ref/#view.EditorProps) to the editor view, for example to respond
to certain events. More complicated ones might add new state to the
editor and update it based on transactions.

When creating a plugin, you pass it [an object](/docs/ref/#state.PluginSpec)
specifying its behavior:

```
let myPlugin = new Plugin({
  props: {
    handleKeyDown(view, event) {
      console.log("A key was pressed!")
      return false // We did not handle this
    }
  }
})

let state = EditorState.create({schema, plugins: [myPlugin]})
```

When a plugin needs its own state slot, that is defined with a
[`state`](/docs/ref/#state.PluginSpec.state) property:

```
let transactionCounter = new Plugin({
  state: {
    init() { return 0 },
    apply(tr, value) { return value + 1 }
  }
})

function getTransactionCount(state) {
  return transactionCounter.getState(state)
}
```

The plugin in the example defines a very simple piece of state that
simply counts the number of transactions that have been applied to a
state. The helper function uses the plugin's
[`getState`](/docs/ref/#state.Plugin.getState) method, which can be used to
fetch the plugin state from a full editor state object.

Because the editor state is a persistent (immutable) object, and
plugin state is part of that object, plugin state values must be
immutable. I.e. their `apply` method must return a new value, rather
than changing the old, if they need to change, and no other code
should change them.

It is often useful for plugins to add some extra information to a
transaction. For example, the undo history, when performing an actual
undo, will mark the resulting transaction, so that when the plugin
sees it, instead of doing the thing it normally does with changes
(adding them to the undo stack), it treats it specially, removing the
top item from the undo stack and adding this transaction to the redo
stack instead.

For this purpose, transactions allow
[*metadata*](/docs/ref/#state.Transaction.getMeta) to be attached to them. We
could update our transaction counter plugin to not count transactions
that are marked, like this:

```
let transactionCounter = new Plugin({
  state: {
    init() { return 0 },
    apply(tr, value) {
      if (tr.getMeta(transactionCounter)) return value
      else return value + 1
    }
  }
})

function markAsUncounted(tr) {
  tr.setMeta(transactionCounter, true)
}
```

Keys for metadata properties can be strings, but to avoid name
collisions, you are encouraged to use plugin objects. There are some
string keys that are given a meaning by the library, for example
`"addToHistory"` can be set to `false` to prevent a transaction from
being undoable, and when handling a paste, the editor view will set
the `"paste"` property on the resulting transaction to true.

The view component
------------------

A ProseMirror [editor view](/docs/ref/#view.EditorView) is a user interface
component that displays an [editor state](#state) to the user, and
allows them to perform editing actions on it.

The definition of *editing actions* used by the core view component is
rather narrow—it handles direct interaction with the editing surface,
such as typing, clicking, copying, pasting, and dragging, but not much
beyond that. This means that things like displaying a menu, or even
providing a full set of key bindings, lie outside of the
responsibility of the core view component, and have to be arranged
through plugins.

### Editable DOM

Browsers allow us to specify that some parts of the DOM are
[editable](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/contentEditable),
which has the effect of allowing focus and a selection in them, and
making it possible to type into them. The view creates a DOM
representation of its document (using your schema's [`toDOM`
methods](/docs/ref/#model.NodeSpec.toDOM) by default), and makes it editable.
When the editable element is focused, ProseMirror makes sure that the
[DOM
selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
corresponds to the selection in the editor state.

It also registers event handlers for many DOM events, which translate
the events into the appropriate [transactions](#state.transactions).
For example, when pasting, the pasted content is
[parsed](/docs/ref/#view.EditorProps.clipboardParser) as a ProseMirror document
slice, and then inserted into the document.

Many events are also let through as they are, and only *then*
reinterpreted in terms of ProseMirror's data model. The browser is
quite good at cursor and selection placement for example (which is a
really difficult problem when you factor in bidirectional text), so
most cursor-motion related keys and mouse actions are handled by the
browser, after which ProseMirror checks what kind of [text
selection](/docs/ref/#state.TextSelection) the current DOM selection would
correspond to. If that selection is different from the current
selection, a transaction that updates the selection is dispatched.

Even typing is usually left to the browser, because interfering with
that tends to break spell-checking, autocapitalizing on some mobile
interfaces, and other native features. When the browser updates the
DOM, the editor notices, re-parses the changed part of the document,
and translates the difference into a transaction.

### Data flow

So the editor view displays a given editor state, and when something
happens, it creates a transaction and broadcasts this. This
transaction is then, typically, used to create a new state, which is
given to the view using its
[`updateState`](/docs/ref/#view.EditorView.updateState) method.

**DOM event**

↗↘

**EditorView**

**Transaction**

↖↙

new **EditorState**

This creates a straightforward, cyclic data flow, as opposed to the
classic approach (in the JavaScript world) of a host of imperative
event handlers, which tends to create a much more complex web of data
flows.

It is possible to ‘intercept’ transactions as they are
[dispatched](/docs/ref/#view.EditorView.dispatch) with the
[`dispatchTransaction` prop](/docs/ref/#view.DirectEditorProps.dispatchTransaction),
in order to wire this cyclic data flow into a larger cycle—if your
whole app is using a data flow model like this, as with
[Redux](https://github.com/reactjs/redux) and similar architectures,
you can integrate ProseMirror's transactions in your main
action-dispatching cycle, and keep ProseMirror's state in your
application ‘store’.

```
// The app's state
let appState = {
  editor: EditorState.create({schema}),
  score: 0
}

let view = new EditorView(document.body, {
  state: appState.editor,
  dispatchTransaction(transaction) {
    update({type: "EDITOR_TRANSACTION", transaction})
  }
})

// A crude app state update function, which takes an update object,
// updates the `appState`, and then refreshes the UI.
function update(event) {
  if (event.type == "EDITOR_TRANSACTION")
    appState.editor = appState.editor.apply(event.transaction)
  else if (event.type == "SCORE_POINT")
    appState.score++
  draw()
}

// An even cruder drawing function
function draw() {
  document.querySelector("#score").textContent = appState.score
  view.updateState(appState.editor)
}
```

### Efficient updating

One way to implement [`updateState`](/docs/ref/#view.EditorView.updateState)
would be to simply redraw the document every time it is called. But
for large documents, that would be really slow.

Since, at the time of updating, the view has access to both the old
document and the new, it can compare them, and leave the parts of the
DOM that correspond to unchanged nodes alone. ProseMirror does this,
allowing it to do very little work for typical updates.

In some cases, like updates that correspond to typed text, which was
already added to the DOM by the browser's own editing actions,
ensuring the DOM and state are coherent doesn't require any DOM
changes at all. (When such a transaction is canceled or modified
somehow, the view *will* undo the DOM change to make sure the DOM and
the state remain synchronized.)

Similarly, the DOM selection is only updated when it is actually out
of sync with the selection in the state, to avoid disrupting the
various pieces of ‘hidden’ state that browsers keep along with the
selection (such as that feature where when you arrow down or up past a
short line, your horizontal position goes back to where it was when you
enter the next long line).

### Props

‘Props’ is a useful, if somewhat vague, term taken from
[React](https://facebook.github.io/react/docs/components-and-props.html).
Props are like parameters to a UI component. Ideally, the set of props
that the component gets completely defines its behavior.

```
let view = new EditorView({
  state: myState,
  editable() { return false }, // Enables read-only behavior
  handleDoubleClick() { console.log("Double click!") }
})
```

As such, the current [state](/docs/ref/#view.DirectEditorProps.state) is one
prop. The value of other props can also vary over time, if the code
that controls the component [updates](/docs/ref/#view.EditorView.setProps)
them, but aren't considered *state*, because the component itself
won't change them. The [`updateState`](/docs/ref/#view.EditorView.updateState)
method is just a shorthand to updating the [`state`
prop](/docs/ref/#view.DirectEditorProps.state).

Plugins are also allowed to [declare](/docs/ref/#state.PluginSpec.props) props,
except for [`state`](/docs/ref/#view.DirectEditorProps.state) and
[`dispatchTransaction`](/docs/ref/#view.DirectEditorProps.dispatchTransaction),
which can only be provided directly to the view.

```
function maxSizePlugin(max) {
  return new Plugin({
    props: {
      editable(state) { return state.doc.content.size < max }
    }
  })
}
```

When a given prop is declared multiple times, how it is handled
depends on the prop. In general, directly provided props take
precedence, after which each plugin gets a turn, in order. For some
props, such as [`domParser`](/docs/ref/#view.EditorProps.domParser), the first
value that is found is used, and others are ignored. For handler
functions that return a boolean to indicate whether they handled the
event, the first one that returns true gets to handle the event. And
finally, for some props, such as
[`attributes`](/docs/ref/#view.EditorProps.attributes) (which can be used to
set attributes on the editable DOM node) and
[`decorations`](/docs/ref/#view.EditorProps.decorations) (which we'll get to in
the next section), the union of all provided values is used.

### Decorations

Decorations give you some control over the way the view draws your
document. They are created by returning values from the [`decorations`
prop](/docs/ref/#view.EditorProps.decorations), and come in three types:

* [Node decorations](/docs/ref/#view.Decoration%5Enode) add styling or other DOM
  attributes to a single node's DOM representation.
* [Widget decorations](/docs/ref/#view.Decoration%5Ewidget) *insert* a DOM node,
  which isn't part of the actual document, at a given position.
* [Inline decorations](/docs/ref/#view.Decoration%5Einline) add styling or
  attributes, much like node decorations, but to all inline nodes in
  a given range.

In order to be able to efficiently draw and compare decorations, they
need to be provided as a [decoration set](/docs/ref/#view.DecorationSet) (which
is a data structure that mimics the tree shape of the actual
document). You create one using the static [`create`
method](/docs/ref/#view.DecorationSet%5Ecreate), providing the document and an
array of decoration objects:

```
let purplePlugin = new Plugin({
  props: {
    decorations(state) {
      return DecorationSet.create(state.doc, [
        Decoration.inline(0, state.doc.content.size, {style: "color: purple"})
      ])
    }
  }
})
```

When you have a lot of decorations, recreating the set on the fly for
every redraw is likely to be too expensive. In such cases, the
recommended way to maintain your decorations is to put the set in your
plugin's state, [map](/docs/ref/#view.DecorationSet.map) it forward through
changes, and only change it when you need to.

```
let specklePlugin = new Plugin({
  state: {
    init(_, {doc}) {
      let speckles = []
      for (let pos = 1; pos < doc.content.size; pos += 4)
        speckles.push(Decoration.inline(pos - 1, pos, {style: "background: yellow"}))
      return DecorationSet.create(doc, speckles)
    },
    apply(tr, set) { return set.map(tr.mapping, tr.doc) }
  },
  props: {
    decorations(state) { return specklePlugin.getState(state) }
  }
})
```

This plugin initializes its state to a decoration set that adds a
yellow-background inline decoration to every 4th position. That's not
terribly useful, but sort of resembles use cases like highlighting
search matches or annotated regions.

When a transaction is applied to the state, the plugin state's
[`apply` method](/docs/ref/#state.StateField.apply) maps the decoration set
forward, causing the decorations to stay in place and ‘fit’ the new
document shape. The mapping method is (for typical, local changes)
made efficient by exploiting the tree shape of the decoration set—only
the parts of the tree that are actually touched by the changes need to
be rebuilt.

(In a real-world plugin, the `apply` method would also be the place
where you [add](/docs/ref/#view.DecorationSet.add) or
[remove](/docs/ref/#view.DecorationSet.remove) decorations based on new events,
possibly by inspecting the changes in the transaction, or based on
plugin-specific metadata attached to the transaction.)

Finally, the `decorations` prop simply returns the plugin state,
causing the decorations to show up in the view.

### Node views

There is one more way in which you can influence the way the editor
view draws your document. [Node views](/docs/ref/#view.NodeView) make it
possible to [define](/docs/ref/#view.EditorProps.nodeViews) a sort of miniature
UI components for individual nodes in your document. They allow you to
render their DOM, define the way they are updated, and write custom
code to react to events.

```
let view = new EditorView({
  state,
  nodeViews: {
    image(node) { return new ImageView(node) }
  }
})

class ImageView {
  constructor(node) {
    // The editor will use this as the node's DOM representation
    this.dom = document.createElement("img")
    this.dom.src = node.attrs.src
    this.dom.addEventListener("click", e => {
      console.log("You clicked me!")
      e.preventDefault()
    })
  }

  stopEvent() { return true }
}
```

The view object that the example defines for image nodes creates its
own custom DOM node for the image, with an event handler added, and
declares, with a `stopEvent` method, that ProseMirror should ignore
events coming from that DOM node.

You'll often want interaction with the node to have some effect on the
actual node in the document. But to create a transaction that changes
a node, you first need to know where that node is. To help with that,
node views get passed a getter function that can be used to query
their current position in the document. Let's modify the example so
that clicking on the node queries you to enter an alt text for the
image:

```
let view = new EditorView({
  state,
  nodeViews: {
    image(node, view, getPos) { return new ImageView(node, view, getPos) }
  }
})

class ImageView {
  constructor(node, view, getPos) {
    this.dom = document.createElement("img")
    this.dom.src = node.attrs.src
    this.dom.alt = node.attrs.alt
    this.dom.addEventListener("click", e => {
      e.preventDefault()
      let alt = prompt("New alt text:", "")
      if (alt) view.dispatch(view.state.tr.setNodeMarkup(getPos(), null, {
        src: node.attrs.src,
        alt
      }))
    })
  }

  stopEvent() { return true }
}
```

[`setNodeMarkup`](/docs/ref/#transform.Transform.setNodeMarkup) is a method that
can be used to change the type or set of attributes for the node at a
given position. In the example, we use `getPos` to find our image's
current position, and give it a new attribute object with the new alt
text.

When a node is updated, the default behavior is to leave its outer DOM
structure intact and compare its children to the new set of children,
updating or replacing those as needed. A node view can override this
with custom behavior, which allows us to do something like changing
the class of a paragraph based on its content.

```
let view = new EditorView({
  state,
  nodeViews: {
    paragraph(node) { return new ParagraphView(node) }
  }
})

class ParagraphView {
  constructor(node) {
    this.dom = this.contentDOM = document.createElement("p")
    if (node.content.size == 0) this.dom.classList.add("empty")
  }

  update(node) {
    if (node.content.size > 0) this.dom.classList.remove("empty")
    else this.dom.classList.add("empty")
    return true
  }
}
```

Images never have content, so in our previous example, we didn't need
to worry about how that would be rendered. But paragraphs do have
content. Node views support two approaches to handling content: you
can let the ProseMirror library manage it, or you can manage it
entirely yourself. If you provide a [`contentDOM`
property](/docs/ref/#view.NodeView.contentDOM), the library will render the
node's content into that, and handle content updates. If you don't,
the content becomes a black box to the editor, and how you display it
and let the user interact with it is entirely up to you.

In this case, we want paragraph content to behave like regular
editable text, so the `contentDOM` property is defined to be the same
as the `dom` property, since the content needs to be rendered directly
into the outer node.

The magic happens in the [`update` method](/docs/ref/#view.NodeView.update).
Firstly, this method is responsible for deciding whether the node view
*can* be updated to show the new node at all. It should return false
when it cannot.

The `update` method in the example makes sure that the `"empty"` class
is present or absent, depending on the content of the new node, and
returns true, to indicate that the update succeeded (at which point
the node's content will be updated).

Commands
--------

In ProseMirror jargon, a *command* is a function that implements an
editing action, which the user can perform by pressing some key
combination or interacting with the menu.

For practical reasons, commands have a slightly convoluted interface.
In their simple form, they are functions taking an [editor
state](#state) and a *dispatch function*
([`EditorView.dispatch`](/docs/ref/#view.EditorView.dispatch) or some other
function that takes transactions), and return a boolean. Here's a
very simple example:

```
function deleteSelection(state, dispatch) {
  if (state.selection.empty) return false
  dispatch(state.tr.deleteSelection())
  return true
}
```

When a command isn't applicable, it should return false and do
nothing. When it is, it should dispatch a transaction and return true.
This is used, for example, by the [keymap plugin](/docs/ref/#keymap) to stop
further handling of key events when the command bound to that key has
been applied.

To be able to query whether a command is applicable for a given state,
without actually executing it, the `dispatch` argument is
optional—commands should simply return true without doing anything
when they are applicable but no `dispatch` argument is given. So the
example command should actually look like this:

```
function deleteSelection(state, dispatch) {
  if (state.selection.empty) return false
  if (dispatch) dispatch(state.tr.deleteSelection())
  return true
}
```

To figure out whether a selection can currently be deleted, you'd call
`deleteSelection(view.state, null)`, whereas to actually execute the
command, you'd do something like `deleteSelection(view.state, view.dispatch)`. A menu bar could use this to determine which menu
items to gray out.

In this form, commands do not get access to the actual editor
view—most commands don't need that, and in this way they can be
applied and tested in settings that don't have a view available. But
some commands do need to interact with the DOM—they might need to
[query](/docs/ref/#view.EditorView.endOfTextblock) whether a given position is
at the end of a textblock, or want to open a dialog positioned
relative to the view. For this purpose, most plugins that call
commands will give them a *third* argument, which is the whole view.

```
function blinkView(_state, dispatch, view) {
  if (dispatch) {
    view.dom.style.background = "yellow"
    setTimeout(() => view.dom.style.background = "", 1000)
  }
  return true
}
```

That (rather useless) example shows that commands don't *have* to
dispatch a transaction—they are called for their side effect, which is
*usually* to dispatch a transaction, but may also be something else,
such as popping up a dialog.

The [`prosemirror-commands`](/docs/ref/#commands) module provides a number of
editing commands, from simple ones such as a variant of the
[`deleteSelection`](/docs/ref/#commands.deleteSelection) command, to rather
complicated ones such as [`joinBackward`](/docs/ref/#commands.joinBackward),
which implements the block-joining behavior that should happen when
you press backspace at the start of a textblock. It also comes with a
[basic keymap](/docs/ref/#commands.baseKeymap) that binds a number of
schema-agnostic commands to the keys that are usually used for them.

When possible, different behavior, even when usually bound to a single
key, is put in different commands. The utility function
[`chainCommands`](/docs/ref/#commands.chainCommands) can be used to combine a
number of commands—they will be tried one after the other until one
return true.

For example, the base keymap binds backspace to the command chain
[`deleteSelection`](/docs/ref/#commands.deleteSelection) (which kicks in when
the selection isn't empty), [`joinBackward`](/docs/ref/#commands.joinBackward)
(when the cursor is at the start of a textblock), and
[`selectNodeBackward`](/docs/ref/#commands.selectNodeBackward) (which selects
the node before the selection, in case the schema forbids the regular
joining behavior). When none of these apply, the browser is allowed to
run its own backspace behavior, which is the appropriate thing for
backspacing things out inside a textblock (so that native spell-check
and such don't get confused).

The commands module also exports a number of command constructors,
such as [`toggleMark`](/docs/ref/#commands.toggleMark), which takes a mark type
and optionally a set of attributes, and returns a command function
that toggles that mark on the current selection.

Some other modules also export command functions—for example
[`undo`](/docs/ref/#history.undo) and [`redo`](/docs/ref/#history.redo) from the history
module. To customize your editor, or to allow users to interact with
custom document nodes, you'll likely want to write your own custom
commands as well.

Collaborative editing
---------------------

Real-time collaborative editing allows multiple people to edit the
same document at the same time. Changes they make are applied
immediately to their local document, and then sent to peers, which
merge in these changes automatically (without manual conflict
resolution), so that editing can proceed uninterrupted, and the
documents keep converging.

This guide describes how to wire up ProseMirror's collaborative
editing functionality.

### Algorithm

ProseMirror's collaborative editing system employs a central authority
which determines in which order changes are applied. If two editors
make changes concurrently, they will both go to this authority with
their changes. The authority will accept the changes from one of them,
and broadcast these changes to all editors. The other's changes will
not be accepted, and when that editor receives new changes from the
server, it'll have to [rebase](#transform.rebasing) its local
changes on top of those from the other editor, and try to submit them
again.

### The Authority

The role of the central authority is actually rather simple. It must...

* Track a current document version
* Accept changes from editors, and when these can be applied, add
  them to its list of changes
* Provide a way for editors to receive changes since a given version

Let's implement a trivial central authority that runs in the same
JavaScript environment as the editors.

```
class Authority {
  constructor(doc) {
    this.doc = doc
    this.steps = []
    this.stepClientIDs = []
    this.onNewSteps = []
  }

  receiveSteps(version, steps, clientID) {
    if (version != this.steps.length) return

    // Apply and accumulate new steps
    steps.forEach(step => {
      this.doc = step.apply(this.doc).doc
      this.steps.push(step)
      this.stepClientIDs.push(clientID)
    })
    // Signal listeners
    this.onNewSteps.forEach(function(f) { f() })
  }

  stepsSince(version) {
    return {
      steps: this.steps.slice(version),
      clientIDs: this.stepClientIDs.slice(version)
    }
  }
}
```

When an editor wants to try and submit their changes to the authority,
they can call `receiveSteps` on it, passing the last version number
they received, along with the new changes they added, and their client
ID (which is a way for them to later recognize which changes came from
them).

When the steps are accepted, the client will notice because the
authority notifies them that new steps are available, and then give
them *their own* steps. In a real implementation, you could also have
`receiveSteps` return a status, and immediately confirm the sent
steps, as an optimization. But the mechanism used here is necessary to
guarantee synchronization on unreliable connections, so you should
always use it as the base case.

This implementation of an authority keeps an endlessly growing array
of steps, the length of which denotes its current version.

### The `collab` Module

The [`collab`](/docs/ref/#collab) module exports a [`collab`](/docs/ref/#collab.collab)
function which returns a plugin that takes care of tracking local
changes, receiving remote changes, and indicating when something has
to be sent to the central authority.

```
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {schema} from "prosemirror-schema-basic"
import collab from "prosemirror-collab"

function collabEditor(authority, place) {
  let view = new EditorView(place, {
    state: EditorState.create({
      doc: authority.doc,
      plugins: [collab.collab({version: authority.steps.length})]
    }),
    dispatchTransaction(transaction) {
      let newState = view.state.apply(transaction)
      view.updateState(newState)
      let sendable = collab.sendableSteps(newState)
      if (sendable)
        authority.receiveSteps(sendable.version, sendable.steps,
                               sendable.clientID)
    }
  })

  authority.onNewSteps.push(function() {
    let newData = authority.stepsSince(collab.getVersion(view.state))
    view.dispatch(
      collab.receiveTransaction(view.state, newData.steps, newData.clientIDs))
  })

  return view
}
```

The `collabEditor` function creates an editor view that has the
`collab` plugin loaded. Whenever the state is updated, it checks
whether there is anything to send to the authority. If so, it sends
it.

It also registers a function that the authority should call when new
steps are available, and which creates a [transaction](/docs/ref/#state.Transaction)
that updates our local editor state to reflect those steps.

When a set of steps gets rejected by the authority, they will remain
unconfirmed until, supposedly soon after, we receive new steps from
the authority. After that happens, because the `onNewSteps` callback
calls `dispatch`, which will call our `dispatchTransaction` function,
the code will try to submit its changes again.

That's all there is to it. Of course, with asynchronous data channels
(such as long polling in
[the collab demo](https://github.com/ProseMirror/website/blob/master/src/collab/client/collab.js)
or web sockets), you'll need somewhat more complicated communication
and synchronization code. And you'll probably also want your authority
to start throwing away steps at some point, so that its memory
consumption doesn't grow without bound. But the general approach is
fully described by this little example.

[Backers](/backers.html)
[Code of Conduct](http://contributor-covenant.org/version/1/1/0/)
[Discuss](https://discuss.prosemirror.net/)
[Report an Issue](https://github.com/prosemirror/prosemirror/issues)


---------------------------------------------------------------------------------

# Posemirror Reference Guide

ProseMirror Reference manual



[ProseMirror](/)

Contents[Examples](/examples/)
[Documentation](/docs/)
[Discuss](https://discuss.prosemirror.net/)
[GitHub](https://github.com/prosemirror)

* [Intro](#top.intro)
* [prosemirror-state](#state)
  + [Editor State](#state.Editor_State)
  + [Selection](#state.Selection)
  + [Plugin System](#state.Plugin_System)
* [prosemirror-view](#view)
  + [Props](#view.Props)
  + [Decorations](#view.Decorations)
* [prosemirror-model](#model)
  + [Document Structure](#model.Document_Structure)
  + [Resolved Positions](#model.Resolved_Positions)
  + [Document Schema](#model.Document_Schema)
  + [DOM Representation](#model.DOM_Representation)
* [prosemirror-transform](#transform)
  + [Steps](#transform.Steps)
  + [Position Mapping](#transform.Position_Mapping)
  + [Document transforms](#transform.Document_transforms)
* [prosemirror-commands](#commands)
* [prosemirror-history](#history)
* [prosemirror-collab](#collab)
* [prosemirror-keymap](#keymap)
* [prosemirror-inputrules](#inputrules)
* [prosemirror-gapcursor](#gapcursor)
* [prosemirror-schema-basic](#schema-basic)
* [prosemirror-schema-list](#schema-list)


Reference manual
----------------

This is the reference manual for the
[ProseMirror](https://prosemirror.net) rich text editor. It lists and
describes the full public API exported by the library. For more
introductory material, please see the [guide](/docs/guide/).

ProseMirror is structured as a number of separate modules. This
reference manual describes the exported API per module. If you want to
use something from the [`prosemirror-state`](#state) module, for
example, you can import it like this:

```
var EditorState = require("prosemirror-state").EditorState
var state = EditorState.create({schema: mySchema})
```

Or, using ES6 syntax:

```
import {EditorState} from "prosemirror-state"
let state = EditorState.create({schema: mySchema})
```

[prosemirror-state module](#state)
----------------------------------

This module implements the state object of a ProseMirror editor, along
with the representation of the selection and the plugin abstraction.

### [Editor State](#state.Editor_State)

ProseMirror keeps all editor state (the things, basically, that would
be required to create an editor just like the current one) in a single
[object](#state.EditorState). That object is updated (creating a new
state) by applying [transactions](#state.Transaction) to it.

#### `class` [EditorState](#state.EditorState)
:   The state of a ProseMirror editor is represented by an object of
    this type. A state is a persistent data structure—it isn't
    updated, but rather a new state value is computed from an old one
    using the [`apply`](#state.EditorState.apply) method.

    A state holds a number of built-in fields, and plugins can
    [define](#state.PluginSpec.state) additional fields.

    `doc: Node`
    :   The current document.

    `selection: Selection`
    :   The selection.

    `storedMarks: readonly Mark[] | null`
    :   A set of marks to apply to the next input. Will be null when
        no explicit marks have been set.

    `schema: Schema`
    :   The schema of the state's document.

    `plugins: readonly Plugin[]`
    :   The plugins that are active in this state.

    `apply(tr: Transaction) → EditorState`
    :   Apply the given transaction to produce a new state.

    `applyTransaction(rootTr: Transaction) → {state: EditorState, transactions: readonly Transaction[]}`
    :   Verbose variant of [`apply`](#state.EditorState.apply) that
        returns the precise transactions that were applied (which might
        be influenced by the [transaction
        hooks](#state.PluginSpec.filterTransaction) of
        plugins) along with the new state.

    `tr: Transaction`
    :   Accessor that constructs and returns a new [transaction](#state.Transaction) from this state.

    `reconfigure(config: Object) → EditorState`
    :   Create a new state based on this one, but with an adjusted set
        of active plugins. State fields that exist in both sets of
        plugins are kept unchanged. Those that no longer exist are
        dropped, and those that are new are initialized using their
        [`init`](#state.StateField.init) method, passing in the new
        configuration object..

        `config`
        :   `plugins⁠?: readonly Plugin[]`
            :   New set of active plugins.

    `toJSON(pluginFields⁠?: Object<Plugin>) → any`
    :   Serialize this state to JSON. If you want to serialize the state
        of plugins, pass an object mapping property names to use in the
        resulting JSON object to plugin objects. The argument may also be
        a string or number, in which case it is ignored, to support the
        way `JSON.stringify` calls `toString` methods.

    `static create(config: EditorStateConfig) → EditorState`
    :   Create a new state.

    `static fromJSON( config: Object, json: any, pluginFields⁠?: Object<Plugin> ) → EditorState`
    :   Deserialize a JSON representation of a state. `config` should
        have at least a `schema` field, and should contain array of
        plugins to initialize the state with. `pluginFields` can be used
        to deserialize the state of plugins, by associating plugin
        instances with the property names they use in the JSON object.

        `config`
        :   `schema: Schema`
            :   The schema to use.

            `plugins⁠?: readonly Plugin[]`
            :   The set of active plugins.

#### `interface` [EditorStateConfig](#state.EditorStateConfig)
:   The type of object passed to
    [`EditorState.create`](#state.EditorState%5Ecreate).

    `schema⁠?: Schema`
    :   The schema to use (only relevant if no `doc` is specified).

    `doc⁠?: Node`
    :   The starting document. Either this or `schema` *must* be
        provided.

    `selection⁠?: Selection`
    :   A valid selection in the document.

    `storedMarks⁠?: readonly Mark[]`
    :   The initial set of [stored marks](#state.EditorState.storedMarks).

    `plugins⁠?: readonly Plugin[]`
    :   The plugins that should be active in this state.

#### `class` [Transaction](#state.Transaction) `extends Transform`
:   An editor state transaction, which can be applied to a state to
    create an updated state. Use
    [`EditorState.tr`](#state.EditorState.tr) to create an instance.

    Transactions track changes to the document (they are a subclass of
    [`Transform`](#transform.Transform)), but also other state changes,
    like selection updates and adjustments of the set of [stored
    marks](#state.EditorState.storedMarks). In addition, you can store
    metadata properties in a transaction, which are extra pieces of
    information that client code or plugins can use to describe what a
    transaction represents, so that they can update their [own
    state](#state.StateField) accordingly.

    The [editor view](#view.EditorView) uses a few metadata
    properties: it will attach a property `"pointer"` with the value
    `true` to selection transactions directly caused by mouse or touch
    input, a `"composition"` property holding an ID identifying the
    composition that caused it to transactions caused by composed DOM
    input, and a `"uiEvent"` property of that may be `"paste"`,
    `"cut"`, or `"drop"`.

    `time: number`
    :   The timestamp associated with this transaction, in the same
        format as `Date.now()`.

    `storedMarks: readonly Mark[] | null`
    :   The stored marks set by this transaction, if any.

    `selection: Selection`
    :   The transaction's current selection. This defaults to the editor
        selection [mapped](#state.Selection.map) through the steps in the
        transaction, but can be overwritten with
        [`setSelection`](#state.Transaction.setSelection).

    `setSelection(selection: Selection) → Transaction`
    :   Update the transaction's current selection. Will determine the
        selection that the editor gets when the transaction is applied.

    `selectionSet: boolean`
    :   Whether the selection was explicitly updated by this transaction.

    `setStoredMarks(marks: readonly Mark[] | null) → Transaction`
    :   Set the current stored marks.

    `ensureMarks(marks: readonly Mark[]) → Transaction`
    :   Make sure the current stored marks or, if that is null, the marks
        at the selection, match the given set of marks. Does nothing if
        this is already the case.

    `addStoredMark(mark: Mark) → Transaction`
    :   Add a mark to the set of stored marks.

    `removeStoredMark(mark: Mark | MarkType) → Transaction`
    :   Remove a mark or mark type from the set of stored marks.

    `storedMarksSet: boolean`
    :   Whether the stored marks were explicitly set for this transaction.

    `setTime(time: number) → Transaction`
    :   Update the timestamp for the transaction.

    `replaceSelection(slice: Slice) → Transaction`
    :   Replace the current selection with the given slice.

    `replaceSelectionWith(node: Node, inheritMarks⁠?: boolean = true) → Transaction`
    :   Replace the selection with the given node. When `inheritMarks` is
        true and the content is inline, it inherits the marks from the
        place where it is inserted.

    `deleteSelection() → Transaction`
    :   Delete the selection.

    `insertText(text: string, from⁠?: number, to⁠?: number) → Transaction`
    :   Replace the given range, or the selection if no range is given,
        with a text node containing the given string.

    `setMeta( key: string | Plugin | PluginKey, value: any ) → Transaction`
    :   Store a metadata property in this transaction, keyed either by
        name or by plugin.

    `getMeta(key: string | Plugin | PluginKey) → any`
    :   Retrieve a metadata property for a given name or plugin.

    `isGeneric: boolean`
    :   Returns true if this transaction doesn't contain any metadata,
        and can thus safely be extended.

    `scrollIntoView() → Transaction`
    :   Indicate that the editor should scroll the selection into view
        when updated to the state produced by this transaction.

    `scrolledIntoView: boolean`
    :   True when this transaction has had `scrollIntoView` called on it.

`type Command = fn( state: EditorState, dispatch⁠?: fn(tr: Transaction), view⁠?: EditorView ) → boolean`
:   Commands are functions that take a state and a an optional
    transaction dispatch function and...

    * determine whether they apply to this state
    * if not, return false
    * if `dispatch` was passed, perform their effect, possibly by
      passing a transaction to `dispatch`
    * return true

    In some cases, the editor view is passed as a third argument.

### [Selection](#state.Selection)

A ProseMirror selection can be one of several types. This module
defines types for classical [text selections](#state.TextSelection)
(of which cursors are a special case) and [*node*
selections](#state.NodeSelection), where a specific document node is
selected. It is possible to extend the editor with custom selection
types.

#### `abstract class` [Selection](#state.Selection)
:   Superclass for editor selections. Every selection type should
    extend this. Should not be instantiated directly.

    `new Selection( $anchor: ResolvedPos, $head: ResolvedPos, ranges⁠?: readonly SelectionRange[] )`
    :   Initialize a selection with the head and anchor and ranges. If no
        ranges are given, constructs a single range across `$anchor` and
        `$head`.

    `$anchor: ResolvedPos`
    :   The resolved anchor of the selection (the side that stays in
        place when the selection is modified).

    `$head: ResolvedPos`
    :   The resolved head of the selection (the side that moves when
        the selection is modified).

    `ranges: readonly SelectionRange[]`
    :   The ranges covered by the selection.

    `anchor: number`
    :   The selection's anchor, as an unresolved position.

    `head: number`
    :   The selection's head.

    `from: number`
    :   The lower bound of the selection's main range.

    `to: number`
    :   The upper bound of the selection's main range.

    `$from: ResolvedPos`
    :   The resolved lower bound of the selection's main range.

    `$to: ResolvedPos`
    :   The resolved upper bound of the selection's main range.

    `empty: boolean`
    :   Indicates whether the selection contains any content.

    `abstract eq(selection: Selection) → boolean`
    :   Test whether the selection is the same as another selection.

    `abstract map(doc: Node, mapping: Mappable) → Selection`
    :   Map this selection through a [mappable](#transform.Mappable)
        thing. `doc` should be the new document to which we are mapping.

    `content() → Slice`
    :   Get the content of this selection as a slice.

    `replace( tr: Transaction, content⁠?: Slice = Slice.empty )`
    :   Replace the selection with a slice or, if no slice is given,
        delete the selection. Will append to the given transaction.

    `replaceWith(tr: Transaction, node: Node)`
    :   Replace the selection with the given node, appending the changes
        to the given transaction.

    `abstract toJSON() → any`
    :   Convert the selection to a JSON representation. When implementing
        this for a custom selection class, make sure to give the object a
        `type` property whose value matches the ID under which you
        [registered](#state.Selection%5EjsonID) your class.

    `getBookmark() → SelectionBookmark`
    :   Get a [bookmark](#state.SelectionBookmark) for this selection,
        which is a value that can be mapped without having access to a
        current document, and later resolved to a real selection for a
        given document again. (This is used mostly by the history to
        track and restore old selections.) The default implementation of
        this method just converts the selection to a text selection and
        returns the bookmark for that.

    `visible: boolean`
    :   Controls whether, when a selection of this type is active in the
        browser, the selected range should be visible to the user.
        Defaults to `true`.

    `static findFrom( $pos: ResolvedPos, dir: number, textOnly⁠?: boolean = false ) → Selection | null`
    :   Find a valid cursor or leaf node selection starting at the given
        position and searching back if `dir` is negative, and forward if
        positive. When `textOnly` is true, only consider cursor
        selections. Will return null when no valid selection position is
        found.

    `static near($pos: ResolvedPos, bias⁠?: number = 1) → Selection`
    :   Find a valid cursor or leaf node selection near the given
        position. Searches forward first by default, but if `bias` is
        negative, it will search backwards first.

    `static atStart(doc: Node) → Selection`
    :   Find the cursor or leaf node selection closest to the start of
        the given document. Will return an
        [`AllSelection`](#state.AllSelection) if no valid position
        exists.

    `static atEnd(doc: Node) → Selection`
    :   Find the cursor or leaf node selection closest to the end of the
        given document.

    `static fromJSON(doc: Node, json: any) → Selection`
    :   Deserialize the JSON representation of a selection. Must be
        implemented for custom classes (as a static class method).

    `static jsonID( id: string, selectionClass: {fromJSON: fn(doc: Node, json: any) → Selection} ) → {fromJSON: fn(doc: Node, json: any) → Selection}`
    :   To be able to deserialize selections from JSON, custom selection
        classes must register themselves with an ID string, so that they
        can be disambiguated. Try to pick something that's unlikely to
        clash with classes from other modules.

#### `class` [TextSelection](#state.TextSelection) `extends Selection`
:   A text selection represents a classical editor selection, with a
    head (the moving side) and anchor (immobile side), both of which
    point into textblock nodes. It can be empty (a regular cursor
    position).

    `new TextSelection( $anchor: ResolvedPos, $head⁠?: ResolvedPos = $anchor )`
    :   Construct a text selection between the given points.

    `$cursor: ResolvedPos | null`
    :   Returns a resolved position if this is a cursor selection (an
        empty text selection), and null otherwise.

    `static create( doc: Node, anchor: number, head⁠?: number = anchor ) → TextSelection`
    :   Create a text selection from non-resolved positions.

    `static between( $anchor: ResolvedPos, $head: ResolvedPos, bias⁠?: number ) → Selection`
    :   Return a text selection that spans the given positions or, if
        they aren't text positions, find a text selection near them.
        `bias` determines whether the method searches forward (default)
        or backwards (negative number) first. Will fall back to calling
        [`Selection.near`](#state.Selection%5Enear) when the document
        doesn't contain a valid text position.

#### `class` [NodeSelection](#state.NodeSelection) `extends Selection`
:   A node selection is a selection that points at a single node. All
    nodes marked [selectable](#model.NodeSpec.selectable) can be the
    target of a node selection. In such a selection, `from` and `to`
    point directly before and after the selected node, `anchor` equals
    `from`, and `head` equals `to`..

    `new NodeSelection($pos: ResolvedPos)`
    :   Create a node selection. Does not verify the validity of its
        argument.

    `node: Node`
    :   The selected node.

    `static create(doc: Node, from: number) → NodeSelection`
    :   Create a node selection from non-resolved positions.

    `static isSelectable(node: Node) → boolean`
    :   Determines whether the given node may be selected as a node
        selection.

#### `class` [AllSelection](#state.AllSelection) `extends Selection`
:   A selection type that represents selecting the whole document
    (which can not necessarily be expressed with a text selection, when
    there are for example leaf block nodes at the start or end of the
    document).

    `new AllSelection(doc: Node)`
    :   Create an all-selection over the given document.

#### `class` [SelectionRange](#state.SelectionRange)
:   Represents a selected range in a document.

    `new SelectionRange($from: ResolvedPos, $to: ResolvedPos)`
    :   Create a range.

    `$from: ResolvedPos`
    :   The lower bound of the range.

    `$to: ResolvedPos`
    :   The upper bound of the range.

#### `interface` [SelectionBookmark](#state.SelectionBookmark)
:   A lightweight, document-independent representation of a selection.
    You can define a custom bookmark type for a custom selection class
    to make the history handle it well.

    `map(mapping: Mappable) → SelectionBookmark`
    :   Map the bookmark through a set of changes.

    `resolve(doc: Node) → Selection`
    :   Resolve the bookmark to a real selection again. This may need to
        do some error checking and may fall back to a default (usually
        [`TextSelection.between`](#state.TextSelection%5Ebetween)) if
        mapping made the bookmark invalid.

### [Plugin System](#state.Plugin_System)

To make it easy to package and enable extra editor functionality,
ProseMirror has a plugin system.

#### `interface` [PluginSpec](#state.PluginSpec)`<PluginState>`
:   This is the type passed to the [`Plugin`](#state.Plugin)
    constructor. It provides a definition for a plugin.

    `props⁠?: EditorProps<Plugin<PluginState>>`
    :   The [view props](#view.EditorProps) added by this plugin. Props
        that are functions will be bound to have the plugin instance as
        their `this` binding.

    `state⁠?: StateField<PluginState>`
    :   Allows a plugin to define a [state field](#state.StateField), an
        extra slot in the state object in which it can keep its own data.

    `key⁠?: PluginKey`
    :   Can be used to make this a keyed plugin. You can have only one
        plugin with a given key in a given state, but it is possible to
        access the plugin's configuration and state through the key,
        without having access to the plugin instance object.

    `view⁠?: fn(view: EditorView) → PluginView`
    :   When the plugin needs to interact with the editor view, or
        set something up in the DOM, use this field. The function
        will be called when the plugin's state is associated with an
        editor view.

    `filterTransaction⁠?: fn(tr: Transaction, state: EditorState) → boolean`
    :   When present, this will be called before a transaction is
        applied by the state, allowing the plugin to cancel it (by
        returning false).

    `appendTransaction⁠?: fn( transactions: readonly Transaction[], oldState: EditorState, newState: EditorState ) → Transaction | null | undefined`
    :   Allows the plugin to append another transaction to be applied
        after the given array of transactions. When another plugin
        appends a transaction after this was called, it is called again
        with the new state and new transactions—but only the new
        transactions, i.e. it won't be passed transactions that it
        already saw.

    `[string]: any`
    :   Additional properties are allowed on plugin specs, which can be
        read via [`Plugin.spec`](#state.Plugin.spec).

#### `interface` [StateField](#state.StateField)`<T>`
:   A plugin spec may provide a state field (under its
    [`state`](#state.PluginSpec.state) property) of this type, which
    describes the state it wants to keep. Functions provided here are
    always called with the plugin instance as their `this` binding.

    `init( config: EditorStateConfig, instance: EditorState ) → T`
    :   Initialize the value of the field. `config` will be the object
        passed to [`EditorState.create`](#state.EditorState%5Ecreate). Note
        that `instance` is a half-initialized state instance, and will
        not have values for plugin fields initialized after this one.

    `apply( tr: Transaction, value: T, oldState: EditorState, newState: EditorState ) → T`
    :   Apply the given transaction to this state field, producing a new
        field value. Note that the `newState` argument is again a partially
        constructed state does not yet contain the state from plugins
        coming after this one.

    `toJSON⁠?: fn(value: T) → any`
    :   Convert this field to JSON. Optional, can be left off to disable
        JSON serialization for the field.

    `fromJSON⁠?: fn( config: EditorStateConfig, value: any, state: EditorState ) → T`
    :   Deserialize the JSON representation of this field. Note that the
        `state` argument is again a half-initialized state.

#### `type` [PluginView](#state.PluginView)
:   A stateful object that can be installed in an editor by a
    [plugin](#state.PluginSpec.view).

    `update⁠?: fn(view: EditorView, prevState: EditorState)`
    :   Called whenever the view's state is updated.

    `destroy⁠?: fn()`
    :   Called when the view is destroyed or receives a state
        with different plugins.

#### `class` [Plugin](#state.Plugin)`<PluginState = any>`
:   Plugins bundle functionality that can be added to an editor.
    They are part of the [editor state](#state.EditorState) and
    may influence that state and the view that contains it.

    `new Plugin(spec: PluginSpec<PluginState>)`
    :   Create a plugin.

    `spec: PluginSpec<PluginState>`
    :   The plugin's [spec object](#state.PluginSpec).

    `props: EditorProps<Plugin<PluginState>>`
    :   The [props](#view.EditorProps) exported by this plugin.

    `getState(state: EditorState) → PluginState | undefined`
    :   Extract the plugin's state field from an editor state.

#### `class` [PluginKey](#state.PluginKey)`<PluginState = any>`
:   A key is used to [tag](#state.PluginSpec.key) plugins in a way
    that makes it possible to find them, given an editor state.
    Assigning a key does mean only one plugin of that type can be
    active in a state.

    `new PluginKey(name⁠?: string = "key")`
    :   Create a plugin key.

    `get(state: EditorState) → Plugin<PluginState> | undefined`
    :   Get the active plugin with this key, if any, from an editor
        state.

    `getState(state: EditorState) → PluginState | undefined`
    :   Get the plugin's state from an editor state.

[prosemirror-view module](#view)
--------------------------------

ProseMirror's view module displays a given [editor
state](#state.EditorState) in the DOM, and handles user events.

Make sure you load `style/prosemirror.css` as a stylesheet when using
this module.

#### `class` [EditorView](#view.EditorView)
:   An editor view manages the DOM structure that represents an
    editable document. Its state and behavior are determined by its
    [props](#view.DirectEditorProps).

    `new EditorView( place: DOMNode | fn(editor: HTMLElement) | {mount: HTMLElement} | null , props: DirectEditorProps )`
    :   Create a view. `place` may be a DOM node that the editor should
        be appended to, a function that will place it into the document,
        or an object whose `mount` property holds the node to use as the
        document container. If it is `null`, the editor will not be
        added to the document.

    `state: EditorState`
    :   The view's current [state](#state.EditorState).

    `dom: HTMLElement`
    :   An editable DOM node containing the document. (You probably
        should not directly interfere with its content.)

    `editable: boolean`
    :   Indicates whether the editor is currently [editable](#view.EditorProps.editable).

    `dragging: {slice: Slice, move: boolean} | null`
    :   When editor content is being dragged, this object contains
        information about the dragged slice and whether it is being
        copied or moved. At any other time, it is null.

    `composing: boolean`
    :   Holds `true` when a
        [composition](https://w3c.github.io/uievents/#events-compositionevents)
        is active.

    `props: DirectEditorProps`
    :   The view's current [props](#view.EditorProps).

    `update(props: DirectEditorProps)`
    :   Update the view's props. Will immediately cause an update to
        the DOM.

    `setProps(props: Partial<DirectEditorProps>)`
    :   Update the view by updating existing props object with the object
        given as argument. Equivalent to `view.update(Object.assign({}, view.props, props))`.

    `updateState(state: EditorState)`
    :   Update the editor's `state` prop, without touching any of the
        other props.

    `someProp<PropName extends keyof EditorProps, Result>( propName: PropName, f: fn( value: NonNullable<EditorProps[PropName]> ) → Result ) → Result | undefined` `someProp<PropName extends keyof EditorProps>(propName: PropName) → NonNullable<EditorProps[PropName]> | undefined`
    :   Goes over the values of a prop, first those provided directly,
        then those from plugins given to the view, then from plugins in
        the state (in order), and calls `f` every time a non-undefined
        value is found. When `f` returns a truthy value, that is
        immediately returned. When `f` isn't provided, it is treated as
        the identity function (the prop value is returned directly).

    `hasFocus() → boolean`
    :   Query whether the view has focus.

    `focus()`
    :   Focus the editor.

    `root: Document | ShadowRoot`
    :   Get the document root in which the editor exists. This will
        usually be the top-level `document`, but might be a [shadow
        DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)
        root if the editor is inside one.

    `updateRoot()`
    :   When an existing editor view is moved to a new document or
        shadow tree, call this to make it recompute its root.

    `posAtCoords(coords: {left: number, top: number}) → {pos: number, inside: number} | null`
    :   Given a pair of viewport coordinates, return the document
        position that corresponds to them. May return null if the given
        coordinates aren't inside of the editor. When an object is
        returned, its `pos` property is the position nearest to the
        coordinates, and its `inside` property holds the position of the
        inner node that the position falls inside of, or -1 if it is at
        the top level, not in any node.

    `coordsAtPos(pos: number, side⁠?: number = 1) → {left: number, right: number, top: number, bottom: number}`
    :   Returns the viewport rectangle at a given document position.
        `left` and `right` will be the same number, as this returns a
        flat cursor-ish rectangle. If the position is between two things
        that aren't directly adjacent, `side` determines which element
        is used. When < 0, the element before the position is used,
        otherwise the element after.

    `domAtPos(pos: number, side⁠?: number = 0) → {node: DOMNode, offset: number}`
    :   Find the DOM position that corresponds to the given document
        position. When `side` is negative, find the position as close as
        possible to the content before the position. When positive,
        prefer positions close to the content after the position. When
        zero, prefer as shallow a position as possible.

        Note that you should **not** mutate the editor's internal DOM,
        only inspect it (and even that is usually not necessary).

    `nodeDOM(pos: number) → DOMNode | null`
    :   Find the DOM node that represents the document node after the
        given position. May return `null` when the position doesn't point
        in front of a node or if the node is inside an opaque node view.

        This is intended to be able to call things like
        `getBoundingClientRect` on that DOM node. Do **not** mutate the
        editor DOM directly, or add styling this way, since that will be
        immediately overriden by the editor as it redraws the node.

    `posAtDOM( node: DOMNode, offset: number, bias⁠?: number = -1 ) → number`
    :   Find the document position that corresponds to a given DOM
        position. (Whenever possible, it is preferable to inspect the
        document structure directly, rather than poking around in the
        DOM, but sometimes—for example when interpreting an event
        target—you don't have a choice.)

        The `bias` parameter can be used to influence which side of a DOM
        node to use when the position is inside a leaf node.

    `endOfTextblock( dir: "up" | "down" | "left" | "right" | "forward" | "backward" , state⁠?: EditorState ) → boolean`
    :   Find out whether the selection is at the end of a textblock when
        moving in a given direction. When, for example, given `"left"`,
        it will return true if moving left from the current cursor
        position would leave that position's parent textblock. Will apply
        to the view's current state by default, but it is possible to
        pass a different state.

    `pasteHTML(html: string, event⁠?: ClipboardEvent) → boolean`
    :   Run the editor's paste logic with the given HTML string. The
        `event`, if given, will be passed to the
        [`handlePaste`](#view.EditorProps.handlePaste) hook.

    `pasteText(text: string, event⁠?: ClipboardEvent) → boolean`
    :   Run the editor's paste logic with the given plain-text input.

    `serializeForClipboard(slice: Slice) → {dom: HTMLElement, text: string, slice: Slice}`
    :   Serialize the given slice as it would be if it was copied from
        this editor. Returns a DOM element that contains a
        representation of the slice as its children, a textual
        representation, and the transformed slice (which can be
        different from the given input due to hooks like
        [`transformCopied`](#view.EditorProps.transformCopied)).

    `destroy()`
    :   Removes the editor from the DOM and destroys all [node
        views](#view.NodeView).

    `isDestroyed: boolean`
    :   This is true when the view has been
        [destroyed](#view.EditorView.destroy) (and thus should not be
        used anymore).

    `dispatchEvent(event: Event)`
    :   Used for testing.

    `dispatch(tr: Transaction)`
    :   Dispatch a transaction. Will call
        [`dispatchTransaction`](#view.DirectEditorProps.dispatchTransaction)
        when given, and otherwise defaults to applying the transaction to
        the current state and calling
        [`updateState`](#view.EditorView.updateState) with the result.
        This method is bound to the view instance, so that it can be
        easily passed around.

### [Props](#view.Props)

#### `interface` [EditorProps](#view.EditorProps)`<P = any>`
:   Props are configuration values that can be passed to an editor view
    or included in a plugin. This interface lists the supported props.

    The various event-handling functions may all return `true` to
    indicate that they handled the given event. The view will then take
    care to call `preventDefault` on the event, except with
    `handleDOMEvents`, where the handler itself is responsible for that.

    How a prop is resolved depends on the prop. Handler functions are
    called one at a time, starting with the base props and then
    searching through the plugins (in order of appearance) until one of
    them returns true. For some props, the first plugin that yields a
    value gets precedence.

    The optional type parameter refers to the type of `this` in prop
    functions, and is used to pass in the plugin type when defining a
    [plugin](#state.Plugin).

    `handleDOMEvents⁠?: { [event in keyof DOMEventMap]: fn( view: EditorView, event: DOMEventMap[event] ) → boolean | undefined }`
    :   Can be an object mapping DOM event type names to functions that
        handle them. Such functions will be called before any handling
        ProseMirror does of events fired on the editable DOM element.
        Contrary to the other event handling props, when returning true
        from such a function, you are responsible for calling
        `preventDefault` yourself (or not, if you want to allow the
        default behavior).

    `handleKeyDown⁠?: fn(view: EditorView, event: KeyboardEvent) → boolean | undefined`
    :   Called when the editor receives a `keydown` event.

    `handleKeyPress⁠?: fn(view: EditorView, event: KeyboardEvent) → boolean | undefined`
    :   Handler for `keypress` events.

    `handleTextInput⁠?: fn( view: EditorView, from: number, to: number, text: string, deflt: fn() → Transaction ) → boolean | undefined`
    :   Whenever the user directly input text, this handler is called
        before the input is applied. If it returns `true`, the default
        behavior of actually inserting the text is suppressed.

    `handleClickOn⁠?: fn( view: EditorView, pos: number, node: Node, nodePos: number, event: MouseEvent, direct: boolean ) → boolean | undefined`
    :   Called for each node around a click, from the inside out. The
        `direct` flag will be true for the inner node.

    `handleClick⁠?: fn( view: EditorView, pos: number, event: MouseEvent ) → boolean | undefined`
    :   Called when the editor is clicked, after `handleClickOn` handlers
        have been called.

    `handleDoubleClickOn⁠?: fn( view: EditorView, pos: number, node: Node, nodePos: number, event: MouseEvent, direct: boolean ) → boolean | undefined`
    :   Called for each node around a double click.

    `handleDoubleClick⁠?: fn( view: EditorView, pos: number, event: MouseEvent ) → boolean | undefined`
    :   Called when the editor is double-clicked, after `handleDoubleClickOn`.

    `handleTripleClickOn⁠?: fn( view: EditorView, pos: number, node: Node, nodePos: number, event: MouseEvent, direct: boolean ) → boolean | undefined`
    :   Called for each node around a triple click.

    `handleTripleClick⁠?: fn( view: EditorView, pos: number, event: MouseEvent ) → boolean | undefined`
    :   Called when the editor is triple-clicked, after `handleTripleClickOn`.

    `handlePaste⁠?: fn( view: EditorView, event: ClipboardEvent, slice: Slice ) → boolean | undefined`
    :   Can be used to override the behavior of pasting. `slice` is the
        pasted content parsed by the editor, but you can directly access
        the event to get at the raw content.

    `handleDrop⁠?: fn( view: EditorView, event: DragEvent, slice: Slice, moved: boolean ) → boolean | undefined`
    :   Called when something is dropped on the editor. `moved` will be
        true if this drop moves from the current selection (which should
        thus be deleted).

    `handleScrollToSelection⁠?: fn(view: EditorView) → boolean`
    :   Called when the view, after updating its state, tries to scroll
        the selection into view. A handler function may return false to
        indicate that it did not handle the scrolling and further
        handlers or the default behavior should be tried.

    `dragCopies⁠?: fn(event: DragEvent) → boolean`
    :   Determines whether an in-editor drag event should copy or move
        the selection. When not given, the event's `altKey` property is
        used on macOS, `ctrlKey` on other platforms.

    `createSelectionBetween⁠?: fn( view: EditorView, anchor: ResolvedPos, head: ResolvedPos ) → Selection | null`
    :   Can be used to override the way a selection is created when
        reading a DOM selection between the given anchor and head.

    `domParser⁠?: DOMParser`
    :   The [parser](#model.DOMParser) to use when reading editor changes
        from the DOM. Defaults to calling
        [`DOMParser.fromSchema`](#model.DOMParser%5EfromSchema) on the
        editor's schema.

    `transformPastedHTML⁠?: fn(html: string, view: EditorView) → string`
    :   Can be used to transform pasted HTML text, *before* it is parsed,
        for example to clean it up.

    `clipboardParser⁠?: DOMParser`
    :   The [parser](#model.DOMParser) to use when reading content from
        the clipboard. When not given, the value of the
        [`domParser`](#view.EditorProps.domParser) prop is used.

    `transformPastedText⁠?: fn( text: string, plain: boolean, view: EditorView ) → string`
    :   Transform pasted plain text. The `plain` flag will be true when
        the text is pasted as plain text.

    `clipboardTextParser⁠?: fn( text: string, $context: ResolvedPos, plain: boolean, view: EditorView ) → Slice`
    :   A function to parse text from the clipboard into a document
        slice. Called after
        [`transformPastedText`](#view.EditorProps.transformPastedText).
        The default behavior is to split the text into lines, wrap them
        in `<p>` tags, and call
        [`clipboardParser`](#view.EditorProps.clipboardParser) on it.
        The `plain` flag will be true when the text is pasted as plain text.

    `transformPasted⁠?: fn( slice: Slice, view: EditorView, plain: boolean ) → Slice`
    :   Can be used to transform pasted or dragged-and-dropped content
        before it is applied to the document. The `plain` flag will be
        true when the text is pasted as plain text.

    `transformCopied⁠?: fn(slice: Slice, view: EditorView) → Slice`
    :   Can be used to transform copied or cut content before it is
        serialized to the clipboard.

    `nodeViews⁠?: Object<NodeViewConstructor>`
    :   Allows you to pass custom rendering and behavior logic for
        nodes. Should map node names to constructor functions that
        produce a [`NodeView`](#view.NodeView) object implementing the
        node's display behavior. The third argument `getPos` is a
        function that can be called to get the node's current position,
        which can be useful when creating transactions to update it.
        Note that if the node is not in the document, the position
        returned by this function will be `undefined`.

        `decorations` is an array of node or inline decorations that are
        active around the node. They are automatically drawn in the
        normal way, and you will usually just want to ignore this, but
        they can also be used as a way to provide context information to
        the node view without adding it to the document itself.

        `innerDecorations` holds the decorations for the node's content.
        You can safely ignore this if your view has no content or a
        `contentDOM` property, since the editor will draw the decorations
        on the content. But if you, for example, want to create a nested
        editor with the content, it may make sense to provide it with the
        inner decorations.

        (For backwards compatibility reasons, [mark
        views](#view.EditorProps.markViews) can also be included in this
        object.)

    `markViews⁠?: Object<MarkViewConstructor>`
    :   Pass custom mark rendering functions. Note that these cannot
        provide the kind of dynamic behavior that [node
        views](#view.NodeView) can—they just provide custom rendering
        logic. The third argument indicates whether the mark's content
        is inline.

    `clipboardSerializer⁠?: DOMSerializer`
    :   The DOM serializer to use when putting content onto the
        clipboard. If not given, the result of
        [`DOMSerializer.fromSchema`](#model.DOMSerializer%5EfromSchema)
        will be used. This object will only have its
        [`serializeFragment`](#model.DOMSerializer.serializeFragment)
        method called, and you may provide an alternative object type
        implementing a compatible method.

    `clipboardTextSerializer⁠?: fn(content: Slice, view: EditorView) → string`
    :   A function that will be called to get the text for the current
        selection when copying text to the clipboard. By default, the
        editor will use [`textBetween`](#model.Node.textBetween) on the
        selected range.

    `decorations⁠?: fn(state: EditorState) → DecorationSource | null | undefined`
    :   A set of [document decorations](#view.Decoration) to show in the
        view.

    `editable⁠?: fn(state: EditorState) → boolean`
    :   When this returns false, the content of the view is not directly
        editable.

    `attributes⁠?: Object<string> | fn(state: EditorState) → Object<string>`
    :   Control the DOM attributes of the editable element. May be either
        an object or a function going from an editor state to an object.
        By default, the element will get a class `"ProseMirror"`, and
        will have its `contentEditable` attribute determined by the
        [`editable` prop](#view.EditorProps.editable). Additional classes
        provided here will be added to the class. For other attributes,
        the value provided first (as in
        [`someProp`](#view.EditorView.someProp)) will be used.

    `scrollThreshold⁠?: number | {top: number, right: number, bottom: number, left: number}`
    :   Determines the distance (in pixels) between the cursor and the
        end of the visible viewport at which point, when scrolling the
        cursor into view, scrolling takes place. Defaults to 0.

    `scrollMargin⁠?: number | {top: number, right: number, bottom: number, left: number}`
    :   Determines the extra space (in pixels) that is left above or
        below the cursor when it is scrolled into view. Defaults to 5.

`type NodeViewConstructor = fn( node: Node, view: EditorView, getPos: fn() → number | undefined, decorations: readonly Decoration[], innerDecorations: DecorationSource ) → NodeView`
:   The type of function [provided](#view.EditorProps.nodeViews) to
    create [node views](#view.NodeView).

`type MarkViewConstructor = fn( mark: Mark, view: EditorView, inline: boolean ) → MarkView`
:   The function types [used](#view.EditorProps.markViews) to create
    mark views.

#### `interface` [DirectEditorProps](#view.DirectEditorProps) `extends EditorProps`
:   The props object given directly to the editor view supports some
    fields that can't be used in plugins:

    `state: EditorState`
    :   The current state of the editor.

    `plugins⁠?: readonly Plugin[]`
    :   A set of plugins to use in the view, applying their [plugin
        view](#state.PluginSpec.view) and
        [props](#state.PluginSpec.props). Passing plugins with a state
        component (a [state field](#state.PluginSpec.state) field or a
        [transaction](#state.PluginSpec.filterTransaction) filter or
        appender) will result in an error, since such plugins must be
        present in the state to work.

    `dispatchTransaction⁠?: fn(tr: Transaction)`
    :   The callback over which to send transactions (state updates)
        produced by the view. If you specify this, you probably want to
        make sure this ends up calling the view's
        [`updateState`](#view.EditorView.updateState) method with a new
        state that has the transaction
        [applied](#state.EditorState.apply). The callback will be bound to have
        the view instance as its `this` binding.

#### `interface` [NodeView](#view.NodeView)
:   By default, document nodes are rendered using the result of the
    [`toDOM`](#model.NodeSpec.toDOM) method of their spec, and managed
    entirely by the editor. For some use cases, such as embedded
    node-specific editing interfaces, you want more control over
    the behavior of a node's in-editor representation, and need to
    [define](#view.EditorProps.nodeViews) a custom node view.

    Objects returned as node views must conform to this interface.

    `dom: DOMNode`
    :   The outer DOM node that represents the document node.

    `contentDOM⁠?: HTMLElement`
    :   The DOM node that should hold the node's content. Only meaningful
        if the node view also defines a `dom` property and if its node
        type is not a leaf node type. When this is present, ProseMirror
        will take care of rendering the node's children into it. When it
        is not present, the node view itself is responsible for rendering
        (or deciding not to render) its child nodes.

    `update⁠?: fn( node: Node, decorations: readonly Decoration[], innerDecorations: DecorationSource ) → boolean`
    :   When given, this will be called when the view is updating
        itself. It will be given a node, an array of active decorations
        around the node (which are automatically drawn, and the node
        view may ignore if it isn't interested in them), and a
        [decoration source](#view.DecorationSource) that represents any
        decorations that apply to the content of the node (which again
        may be ignored). It should return true if it was able to update
        to that node, and false otherwise. If the node view has a
        `contentDOM` property (or no `dom` property), updating its child
        nodes will be handled by ProseMirror.

    `multiType⁠?: boolean`
    :   By default, `update` will only be called when a node of the same
        node type appears in this view's position. When you set this to
        true, it will be called for any node, making it possible to have
        a node view that representsmultiple types of nodes. You will
        need to check the type of the nodes you get in `update` and
        return `false` for types you cannot handle.

    `selectNode⁠?: fn()`
    :   Can be used to override the way the node's selected status (as a
        node selection) is displayed.

    `deselectNode⁠?: fn()`
    :   When defining a `selectNode` method, you should also provide a
        `deselectNode` method to remove the effect again.

    `setSelection⁠?: fn( anchor: number, head: number, root: Document | ShadowRoot )`
    :   This will be called to handle setting the selection inside the
        node. The `anchor` and `head` positions are relative to the start
        of the node. By default, a DOM selection will be created between
        the DOM positions corresponding to those positions, but if you
        override it you can do something else.

    `stopEvent⁠?: fn(event: Event) → boolean`
    :   Can be used to prevent the editor view from trying to handle some
        or all DOM events that bubble up from the node view. Events for
        which this returns true are not handled by the editor.

    `ignoreMutation⁠?: fn(mutation: ViewMutationRecord) → boolean`
    :   Called when a [mutation](#view.ViewMutationRecord) happens within the
        view. Return false if the editor should re-read the selection or re-parse
        the range around the mutation, true if it can safely be ignored.

    `destroy⁠?: fn()`
    :   Called when the node view is removed from the editor or the whole
        editor is destroyed.

#### `interface` [MarkView](#view.MarkView)
:   By default, document marks are rendered using the result of the
    [`toDOM`](#model.MarkSpec.toDOM) method of their spec, and managed entirely
    by the editor. For some use cases, you want more control over the behavior
    of a mark's in-editor representation, and need to
    [define](#view.EditorProps.markViews) a custom mark view.

    Objects returned as mark views must conform to this interface.

    `dom: DOMNode`
    :   The outer DOM node that represents the document node.

    `contentDOM⁠?: HTMLElement`
    :   The DOM node that should hold the mark's content. When this is not
        present, the `dom` property is used as the content DOM.

    `ignoreMutation⁠?: fn(mutation: ViewMutationRecord) → boolean`
    :   Called when a [mutation](#view.ViewMutationRecord) happens within the
        view. Return false if the editor should re-read the selection or re-parse
        the range around the mutation, true if it can safely be ignored.

    `destroy⁠?: fn()`
    :   Called when the mark view is removed from the editor or the whole
        editor is destroyed.

`type ViewMutationRecord = MutationRecord | {type: "selection", target: DOMNode}`
:   A ViewMutationRecord represents a DOM
    [mutation](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
    or a selection change happens within the view. When the change is
    a selection change, the record will have a `type` property of
    `"selection"` (which doesn't occur for native mutation records).

#### `interface` [DOMEventMap](#view.DOMEventMap) `extends HTMLElementEventMap`
:   Helper type that maps event names to event object types, but
    includes events that TypeScript's HTMLElementEventMap doesn't know
    about.

    `[string]: any`

### [Decorations](#view.Decorations)

Decorations make it possible to influence the way the document is
drawn, without actually changing the document.

#### `class` [Decoration](#view.Decoration)
:   Decoration objects can be provided to the view through the
    [`decorations` prop](#view.EditorProps.decorations). They come in
    several variants—see the static members of this class for details.

    `from: number`
    :   The start position of the decoration.

    `to: number`
    :   The end position. Will be the same as `from` for [widget
        decorations](#view.Decoration%5Ewidget).

    `spec: any`
    :   The spec provided when creating this decoration. Can be useful
        if you've stored extra information in that object.

    `static widget( pos: number, toDOM: fn( view: EditorView, getPos: fn() → number | undefined ) → DOMNode | DOMNode , spec⁠?: Object ) → Decoration`
    :   Creates a widget decoration, which is a DOM node that's shown in
        the document at the given position. It is recommended that you
        delay rendering the widget by passing a function that will be
        called when the widget is actually drawn in a view, but you can
        also directly pass a DOM node. `getPos` can be used to find the
        widget's current document position.

        `spec`
        :   `side⁠?: number`
            :   Controls which side of the document position this widget is
                associated with. When negative, it is drawn before a cursor
                at its position, and content inserted at that position ends
                up after the widget. When zero (the default) or positive, the
                widget is drawn after the cursor and content inserted there
                ends up before the widget.

                When there are multiple widgets at a given position, their
                `side` values determine the order in which they appear. Those
                with lower values appear first. The ordering of widgets with
                the same `side` value is unspecified.

                When `marks` is null, `side` also determines the marks that
                the widget is wrapped in—those of the node before when
                negative, those of the node after when positive.

            `relaxedSide⁠?: boolean`
            :   By default, the cursor, when at the position of the widget,
                will be strictly kept on the side indicated by
                [`side`](#view.Decoration%5Ewidget%5Espec.side). Set this to true
                to allow the DOM selection to stay on the other side if the
                client sets it there.

                **Note**: Mapping of this decoration, which decides on which
                side insertions at its position appear, will still happen
                according to `side`, and keyboard cursor motion will not,
                without further custom handling, visit both sides of the
                widget.

            `marks⁠?: readonly Mark[]`
            :   The precise set of marks to draw around the widget.

            `stopEvent⁠?: fn(event: Event) → boolean`
            :   Can be used to control which DOM events, when they bubble out
                of this widget, the editor view should ignore.

            `ignoreSelection⁠?: boolean`
            :   When set (defaults to false), selection changes inside the
                widget are ignored, and don't cause ProseMirror to try and
                re-sync the selection with its selection state.

            `key⁠?: string`
            :   When comparing decorations of this type (in order to decide
                whether it needs to be redrawn), ProseMirror will by default
                compare the widget DOM node by identity. If you pass a key,
                that key will be compared instead, which can be useful when
                you generate decorations on the fly and don't want to store
                and reuse DOM nodes. Make sure that any widgets with the same
                key are interchangeable—if widgets differ in, for example,
                the behavior of some event handler, they should get
                different keys.

            `destroy⁠?: fn(node: DOMNode)`
            :   Called when the widget decoration is removed or the editor is
                destroyed.

            `[string]: any`
            :   Specs allow arbitrary additional properties.

    `static inline( from: number, to: number, attrs: DecorationAttrs, spec⁠?: Object ) → Decoration`
    :   Creates an inline decoration, which adds the given attributes to
        each inline node between `from` and `to`.

        `spec`
        :   `inclusiveStart⁠?: boolean`
            :   Determines how the left side of the decoration is
                [mapped](#transform.Position_Mapping) when content is
                inserted directly at that position. By default, the decoration
                won't include the new content, but you can set this to `true`
                to make it inclusive.

            `inclusiveEnd⁠?: boolean`
            :   Determines how the right side of the decoration is mapped.
                See
                [`inclusiveStart`](#view.Decoration%5Einline%5Espec.inclusiveStart).

            `[string]: any`
            :   Specs may have arbitrary additional properties.

    `static node( from: number, to: number, attrs: DecorationAttrs, spec⁠?: any ) → Decoration`
    :   Creates a node decoration. `from` and `to` should point precisely
        before and after a node in the document. That node, and only that
        node, will receive the given attributes.

#### `type` [DecorationAttrs](#view.DecorationAttrs)
:   A set of attributes to add to a decorated node. Most properties
    simply directly correspond to DOM attributes of the same name,
    which will be set to the property's value. These are exceptions:

    `nodeName⁠?: string`
    :   When non-null, the target node is wrapped in a DOM element of
        this type (and the other attributes are applied to this element).

    `class⁠?: string`
    :   A CSS class name or a space-separated set of class names to be
        *added* to the classes that the node already had.

    `style⁠?: string`
    :   A string of CSS to be *added* to the node's existing `style` property.

    `[string]: string | undefined`
    :   Any other properties are treated as regular DOM attributes.

#### `class` [DecorationSet](#view.DecorationSet) `implements DecorationSource`
:   A collection of [decorations](#view.Decoration), organized in such
    a way that the drawing algorithm can efficiently use and compare
    them. This is a persistent data structure—it is not modified,
    updates create a new value.

    `find( start⁠?: number, end⁠?: number, predicate⁠?: fn(spec: any) → boolean ) → Decoration[]`
    :   Find all decorations in this set which touch the given range
        (including decorations that start or end directly at the
        boundaries) and match the given predicate on their spec. When
        `start` and `end` are omitted, all decorations in the set are
        considered. When `predicate` isn't given, all decorations are
        assumed to match.

    `map(mapping: Mapping, doc: Node, options⁠?: Object) → DecorationSet`
    :   Map the set of decorations in response to a change in the
        document.

        `options`
        :   `onRemove⁠?: fn(decorationSpec: any)`
            :   When given, this function will be called for each decoration
                that gets dropped as a result of the mapping, passing the
                spec of that decoration.

    `add(doc: Node, decorations: Decoration[]) → DecorationSet`
    :   Add the given array of decorations to the ones in the set,
        producing a new set. Consumes the `decorations` array. Needs
        access to the current document to create the appropriate tree
        structure.

    `remove(decorations: Decoration[]) → DecorationSet`
    :   Create a new set that contains the decorations in this set, minus
        the ones in the given array.

    `static create(doc: Node, decorations: Decoration[]) → DecorationSet`
    :   Create a set of decorations, using the structure of the given
        document. This will consume (modify) the `decorations` array, so
        you must make a copy if you want need to preserve that.

    `static empty: DecorationSet`
    :   The empty set of decorations.

#### `interface` [DecorationSource](#view.DecorationSource)
:   An object that can [provide](#view.EditorProps.decorations)
    decorations. Implemented by [`DecorationSet`](#view.DecorationSet),
    and passed to [node views](#view.EditorProps.nodeViews).

    `map(mapping: Mapping, node: Node) → DecorationSource`
    :   Map the set of decorations in response to a change in the
        document.

    `forChild(offset: number, child: Node) → DecorationSource`
    :   Extract a DecorationSource containing decorations for the given child node at the given offset.

    `forEachSet(f: fn(set: DecorationSet))`
    :   Call the given function for each decoration set in the group.

[prosemirror-model module](#model)
----------------------------------

This module defines ProseMirror's content model, the data structures
used to represent and work with documents.

### [Document Structure](#model.Document_Structure)

A ProseMirror document is a tree. At each level, a [node](#model.Node)
describes the type of the content, and holds a
[fragment](#model.Fragment) containing its children.

#### `class` [Node](#model.Node)
:   This class represents a node in the tree that makes up a
    ProseMirror document. So a document is an instance of `Node`, with
    children that are also instances of `Node`.

    Nodes are persistent data structures. Instead of changing them, you
    create new ones with the content you want. Old ones keep pointing
    at the old document shape. This is made cheaper by sharing
    structure between the old and new data as much as possible, which a
    tree shape like this (without back pointers) makes easy.

    **Do not** directly mutate the properties of a `Node` object. See
    [the guide](/docs/guide/#doc) for more information.

    `type: NodeType`
    :   The type of node that this is.

    `attrs: Attrs`
    :   An object mapping attribute names to values. The kind of
        attributes allowed and required are
        [determined](#model.NodeSpec.attrs) by the node type.

    `marks: readonly Mark[]`
    :   The marks (things like whether it is emphasized or part of a
        link) applied to this node.

    `content: Fragment`
    :   A container holding the node's children.

    `children: readonly Node[]`
    :   The array of this node's child nodes.

    `text: string | undefined`
    :   For text nodes, this contains the node's text content.

    `nodeSize: number`
    :   The size of this node, as defined by the integer-based [indexing
        scheme](/docs/guide/#doc.indexing). For text nodes, this is the
        amount of characters. For other leaf nodes, it is one. For
        non-leaf nodes, it is the size of the content plus two (the
        start and end token).

    `childCount: number`
    :   The number of children that the node has.

    `child(index: number) → Node`
    :   Get the child node at the given index. Raises an error when the
        index is out of range.

    `maybeChild(index: number) → Node | null`
    :   Get the child node at the given index, if it exists.

    `forEach( f: fn(node: Node, offset: number, index: number) )`
    :   Call `f` for every child node, passing the node, its offset
        into this parent node, and its index.

    `nodesBetween( from: number, to: number, f: fn( node: Node, pos: number, parent: Node | null, index: number ) → boolean | undefined, startPos⁠?: number = 0 )`
    :   Invoke a callback for all descendant nodes recursively between
        the given two positions that are relative to start of this
        node's content. The callback is invoked with the node, its
        position relative to the original node (method receiver),
        its parent node, and its child index. When the callback returns
        false for a given node, that node's children will not be
        recursed over. The last parameter can be used to specify a
        starting position to count from.

    `descendants( f: fn( node: Node, pos: number, parent: Node | null, index: number ) → boolean | undefined )`
    :   Call the given callback for every descendant node. Doesn't
        descend into a node when the callback returns `false`.

    `textContent: string`
    :   Concatenates all the text nodes found in this fragment and its
        children.

    `textBetween( from: number, to: number, blockSeparator⁠?: string, leafText⁠?: string | fn(leafNode: Node) → string | null ) → string`
    :   Get all text between positions `from` and `to`. When
        `blockSeparator` is given, it will be inserted to separate text
        from different block nodes. If `leafText` is given, it'll be
        inserted for every non-text leaf node encountered, otherwise
        [`leafText`](#model.NodeSpec.leafText) will be used.

    `firstChild: Node | null`
    :   Returns this node's first child, or `null` if there are no
        children.

    `lastChild: Node | null`
    :   Returns this node's last child, or `null` if there are no
        children.

    `eq(other: Node) → boolean`
    :   Test whether two nodes represent the same piece of document.

    `sameMarkup(other: Node) → boolean`
    :   Compare the markup (type, attributes, and marks) of this node to
        those of another. Returns `true` if both have the same markup.

    `hasMarkup( type: NodeType, attrs⁠?: Attrs, marks⁠?: readonly Mark[] ) → boolean`
    :   Check whether this node's markup correspond to the given type,
        attributes, and marks.

    `copy(content⁠?: Fragment | null = null) → Node`
    :   Create a new node with the same markup as this node, containing
        the given content (or empty, if no content is given).

    `mark(marks: readonly Mark[]) → Node`
    :   Create a copy of this node, with the given set of marks instead
        of the node's own marks.

    `cut(from: number, to⁠?: number = this.content.size) → Node`
    :   Create a copy of this node with only the content between the
        given positions. If `to` is not given, it defaults to the end of
        the node.

    `slice( from: number, to⁠?: number = this.content.size, includeParents⁠?: boolean = false ) → Slice`
    :   Cut out the part of the document between the given positions, and
        return it as a `Slice` object.

    `replace(from: number, to: number, slice: Slice) → Node`
    :   Replace the part of the document between the given positions with
        the given slice. The slice must 'fit', meaning its open sides
        must be able to connect to the surrounding content, and its
        content nodes must be valid children for the node they are placed
        into. If any of this is violated, an error of type
        [`ReplaceError`](#model.ReplaceError) is thrown.

    `nodeAt(pos: number) → Node | null`
    :   Find the node directly after the given position.

    `childAfter(pos: number) → {node: Node | null, index: number, offset: number}`
    :   Find the (direct) child node after the given offset, if any,
        and return it along with its index and offset relative to this
        node.

    `childBefore(pos: number) → {node: Node | null, index: number, offset: number}`
    :   Find the (direct) child node before the given offset, if any,
        and return it along with its index and offset relative to this
        node.

    `resolve(pos: number) → ResolvedPos`
    :   Resolve the given position in the document, returning an
        [object](#model.ResolvedPos) with information about its context.

    `rangeHasMark( from: number, to: number, type: Mark | MarkType ) → boolean`
    :   Test whether a given mark or mark type occurs in this document
        between the two given positions.

    `isBlock: boolean`
    :   True when this is a block (non-inline node)

    `isTextblock: boolean`
    :   True when this is a textblock node, a block node with inline
        content.

    `inlineContent: boolean`
    :   True when this node allows inline content.

    `isInline: boolean`
    :   True when this is an inline node (a text node or a node that can
        appear among text).

    `isText: boolean`
    :   True when this is a text node.

    `isLeaf: boolean`
    :   True when this is a leaf node.

    `isAtom: boolean`
    :   True when this is an atom, i.e. when it does not have directly
        editable content. This is usually the same as `isLeaf`, but can
        be configured with the [`atom` property](#model.NodeSpec.atom)
        on a node's spec (typically used when the node is displayed as
        an uneditable [node view](#view.NodeView)).

    `toString() → string`
    :   Return a string representation of this node for debugging
        purposes.

    `contentMatchAt(index: number) → ContentMatch`
    :   Get the content match in this node at the given index.

    `canReplace( from: number, to: number, replacement⁠?: Fragment = Fragment.empty, start⁠?: number = 0, end⁠?: number = replacement.childCount ) → boolean`
    :   Test whether replacing the range between `from` and `to` (by
        child index) with the given replacement fragment (which defaults
        to the empty fragment) would leave the node's content valid. You
        can optionally pass `start` and `end` indices into the
        replacement fragment.

    `canReplaceWith( from: number, to: number, type: NodeType, marks⁠?: readonly Mark[] ) → boolean`
    :   Test whether replacing the range `from` to `to` (by index) with
        a node of the given type would leave the node's content valid.

    `canAppend(other: Node) → boolean`
    :   Test whether the given node's content could be appended to this
        node. If that node is empty, this will only return true if there
        is at least one node type that can appear in both nodes (to avoid
        merging completely incompatible nodes).

    `check()`
    :   Check whether this node and its descendants conform to the
        schema, and raise an exception when they do not.

    `toJSON() → any`
    :   Return a JSON-serializeable representation of this node.

    `static fromJSON(schema: Schema, json: any) → Node`
    :   Deserialize a node from its JSON representation.

#### `class` [Fragment](#model.Fragment)
:   A fragment represents a node's collection of child nodes.

    Like nodes, fragments are persistent data structures, and you
    should not mutate them or their content. Rather, you create new
    instances whenever needed. The API tries to make this easy.

    `size: number`
    :   The size of the fragment, which is the total of the size of
        its content nodes.

    `content: readonly Node[]`
    :   The child nodes in this fragment.

    `nodesBetween( from: number, to: number, f: fn( node: Node, start: number, parent: Node | null, index: number ) → boolean | undefined, nodeStart⁠?: number = 0, parent⁠?: Node )`
    :   Invoke a callback for all descendant nodes between the given two
        positions (relative to start of this fragment). Doesn't descend
        into a node when the callback returns `false`.

    `descendants( f: fn( node: Node, pos: number, parent: Node | null, index: number ) → boolean | undefined )`
    :   Call the given callback for every descendant node. `pos` will be
        relative to the start of the fragment. The callback may return
        `false` to prevent traversal of a given node's children.

    `textBetween( from: number, to: number, blockSeparator⁠?: string, leafText⁠?: string | fn(leafNode: Node) → string | null ) → string`
    :   Extract the text between `from` and `to`. See the same method on
        [`Node`](#model.Node.textBetween).

    `append(other: Fragment) → Fragment`
    :   Create a new fragment containing the combined content of this
        fragment and the other.

    `cut(from: number, to⁠?: number = this.size) → Fragment`
    :   Cut out the sub-fragment between the two given positions.

    `replaceChild(index: number, node: Node) → Fragment`
    :   Create a new fragment in which the node at the given index is
        replaced by the given node.

    `addToStart(node: Node) → Fragment`
    :   Create a new fragment by prepending the given node to this
        fragment.

    `addToEnd(node: Node) → Fragment`
    :   Create a new fragment by appending the given node to this
        fragment.

    `eq(other: Fragment) → boolean`
    :   Compare this fragment to another one.

    `firstChild: Node | null`
    :   The first child of the fragment, or `null` if it is empty.

    `lastChild: Node | null`
    :   The last child of the fragment, or `null` if it is empty.

    `childCount: number`
    :   The number of child nodes in this fragment.

    `child(index: number) → Node`
    :   Get the child node at the given index. Raise an error when the
        index is out of range.

    `maybeChild(index: number) → Node | null`
    :   Get the child node at the given index, if it exists.

    `forEach( f: fn(node: Node, offset: number, index: number) )`
    :   Call `f` for every child node, passing the node, its offset
        into this parent node, and its index.

    `findDiffStart(other: Fragment, pos⁠?: number = 0) → number | null`
    :   Find the first position at which this fragment and another
        fragment differ, or `null` if they are the same.

    `findDiffEnd( other: Fragment, pos⁠?: number = this.size, otherPos⁠?: number = other.size ) → {a: number, b: number} | null`
    :   Find the first position, searching from the end, at which this
        fragment and the given fragment differ, or `null` if they are
        the same. Since this position will not be the same in both
        nodes, an object with two separate positions is returned.

    `toString() → string`
    :   Return a debugging string that describes this fragment.

    `toJSON() → any`
    :   Create a JSON-serializeable representation of this fragment.

    `static fromJSON(schema: Schema, value: any) → Fragment`
    :   Deserialize a fragment from its JSON representation.

    `static fromArray(array: readonly Node[]) → Fragment`
    :   Build a fragment from an array of nodes. Ensures that adjacent
        text nodes with the same marks are joined together.

    `static from( nodes⁠?: Fragment | Node | readonly Node[] | null ) → Fragment`
    :   Create a fragment from something that can be interpreted as a
        set of nodes. For `null`, it returns the empty fragment. For a
        fragment, the fragment itself. For a node or array of nodes, a
        fragment containing those nodes.

    `static empty: Fragment`
    :   An empty fragment. Intended to be reused whenever a node doesn't
        contain anything (rather than allocating a new empty fragment for
        each leaf node).

#### `class` [Mark](#model.Mark)
:   A mark is a piece of information that can be attached to a node,
    such as it being emphasized, in code font, or a link. It has a
    type and optionally a set of attributes that provide further
    information (such as the target of the link). Marks are created
    through a `Schema`, which controls which types exist and which
    attributes they have.

    `type: MarkType`
    :   The type of this mark.

    `attrs: Attrs`
    :   The attributes associated with this mark.

    `addToSet(set: readonly Mark[]) → readonly Mark[]`
    :   Given a set of marks, create a new set which contains this one as
        well, in the right position. If this mark is already in the set,
        the set itself is returned. If any marks that are set to be
        [exclusive](#model.MarkSpec.excludes) with this mark are present,
        those are replaced by this one.

    `removeFromSet(set: readonly Mark[]) → readonly Mark[]`
    :   Remove this mark from the given set, returning a new set. If this
        mark is not in the set, the set itself is returned.

    `isInSet(set: readonly Mark[]) → boolean`
    :   Test whether this mark is in the given set of marks.

    `eq(other: Mark) → boolean`
    :   Test whether this mark has the same type and attributes as
        another mark.

    `toJSON() → any`
    :   Convert this mark to a JSON-serializeable representation.

    `static fromJSON(schema: Schema, json: any) → Mark`
    :   Deserialize a mark from JSON.

    `static sameSet(a: readonly Mark[], b: readonly Mark[]) → boolean`
    :   Test whether two sets of marks are identical.

    `static setFrom(marks⁠?: Mark | readonly Mark[] | null) → readonly Mark[]`
    :   Create a properly sorted mark set from null, a single mark, or an
        unsorted array of marks.

    `static none: readonly Mark[]`
    :   The empty set of marks.

#### `class` [Slice](#model.Slice)
:   A slice represents a piece cut out of a larger document. It
    stores not only a fragment, but also the depth up to which nodes on
    both side are ‘open’ (cut through).

    `new Slice( content: Fragment, openStart: number, openEnd: number )`
    :   Create a slice. When specifying a non-zero open depth, you must
        make sure that there are nodes of at least that depth at the
        appropriate side of the fragment—i.e. if the fragment is an
        empty paragraph node, `openStart` and `openEnd` can't be greater
        than 1.

        It is not necessary for the content of open nodes to conform to
        the schema's content constraints, though it should be a valid
        start/end/middle for such a node, depending on which sides are
        open.

    `content: Fragment`
    :   The slice's content.

    `openStart: number`
    :   The open depth at the start of the fragment.

    `openEnd: number`
    :   The open depth at the end.

    `size: number`
    :   The size this slice would add when inserted into a document.

    `eq(other: Slice) → boolean`
    :   Tests whether this slice is equal to another slice.

    `toJSON() → any`
    :   Convert a slice to a JSON-serializable representation.

    `static fromJSON(schema: Schema, json: any) → Slice`
    :   Deserialize a slice from its JSON representation.

    `static maxOpen( fragment: Fragment, openIsolating⁠?: boolean = true ) → Slice`
    :   Create a slice from a fragment by taking the maximum possible
        open value on both side of the fragment.

    `static empty: Slice`
    :   The empty slice.

#### `type` [Attrs](#model.Attrs)
:   An object holding the attributes of a node.

#### `class` [ReplaceError](#model.ReplaceError) `extends Error`
:   Error type raised by [`Node.replace`](#model.Node.replace) when
    given an invalid replacement.

### [Resolved Positions](#model.Resolved_Positions)

Positions in a document can be represented as integer
[offsets](/docs/guide/#doc.indexing). But you'll often want to use a
more convenient representation.

#### `class` [ResolvedPos](#model.ResolvedPos)
:   You can [*resolve*](#model.Node.resolve) a position to get more
    information about it. Objects of this class represent such a
    resolved position, providing various pieces of context
    information, and some helper methods.

    Throughout this interface, methods that take an optional `depth`
    parameter will interpret undefined as `this.depth` and negative
    numbers as `this.depth + value`.

    `depth: number`
    :   The number of levels the parent node is from the root. If this
        position points directly into the root node, it is 0. If it
        points into a top-level paragraph, 1, and so on.

    `pos: number`
    :   The position that was resolved.

    `parentOffset: number`
    :   The offset this position has into its parent node.

    `parent: Node`
    :   The parent node that the position points into. Note that even if
        a position points into a text node, that node is not considered
        the parent—text nodes are ‘flat’ in this model, and have no content.

    `doc: Node`
    :   The root node in which the position was resolved.

    `node(depth⁠?: number) → Node`
    :   The ancestor node at the given level. `p.node(p.depth)` is the
        same as `p.parent`.

    `index(depth⁠?: number) → number`
    :   The index into the ancestor at the given level. If this points
        at the 3rd node in the 2nd paragraph on the top level, for
        example, `p.index(0)` is 1 and `p.index(1)` is 2.

    `indexAfter(depth⁠?: number) → number`
    :   The index pointing after this position into the ancestor at the
        given level.

    `start(depth⁠?: number) → number`
    :   The (absolute) position at the start of the node at the given
        level.

    `end(depth⁠?: number) → number`
    :   The (absolute) position at the end of the node at the given
        level.

    `before(depth⁠?: number) → number`
    :   The (absolute) position directly before the wrapping node at the
        given level, or, when `depth` is `this.depth + 1`, the original
        position.

    `after(depth⁠?: number) → number`
    :   The (absolute) position directly after the wrapping node at the
        given level, or the original position when `depth` is `this.depth + 1`.

    `textOffset: number`
    :   When this position points into a text node, this returns the
        distance between the position and the start of the text node.
        Will be zero for positions that point between nodes.

    `nodeAfter: Node | null`
    :   Get the node directly after the position, if any. If the position
        points into a text node, only the part of that node after the
        position is returned.

    `nodeBefore: Node | null`
    :   Get the node directly before the position, if any. If the
        position points into a text node, only the part of that node
        before the position is returned.

    `posAtIndex(index: number, depth⁠?: number) → number`
    :   Get the position at the given index in the parent node at the
        given depth (which defaults to `this.depth`).

    `marks() → readonly Mark[]`
    :   Get the marks at this position, factoring in the surrounding
        marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
        position is at the start of a non-empty node, the marks of the
        node after it (if any) are returned.

    `marksAcross($end: ResolvedPos) → readonly Mark[] | null`
    :   Get the marks after the current position, if any, except those
        that are non-inclusive and not present at position `$end`. This
        is mostly useful for getting the set of marks to preserve after a
        deletion. Will return `null` if this position is at the end of
        its parent node or its parent node isn't a textblock (in which
        case no marks should be preserved).

    `sharedDepth(pos: number) → number`
    :   The depth up to which this position and the given (non-resolved)
        position share the same parent nodes.

    `blockRange( other⁠?: ResolvedPos = this, pred⁠?: fn(node: Node) → boolean ) → NodeRange | null`
    :   Returns a range based on the place where this position and the
        given position diverge around block content. If both point into
        the same textblock, for example, a range around that textblock
        will be returned. If they point into different blocks, the range
        around those blocks in their shared ancestor is returned. You can
        pass in an optional predicate that will be called with a parent
        node to see if a range into that parent is acceptable.

    `sameParent(other: ResolvedPos) → boolean`
    :   Query whether the given position shares the same parent node.

    `max(other: ResolvedPos) → ResolvedPos`
    :   Return the greater of this and the given position.

    `min(other: ResolvedPos) → ResolvedPos`
    :   Return the smaller of this and the given position.

#### `class` [NodeRange](#model.NodeRange)
:   Represents a flat range of content, i.e. one that starts and
    ends in the same node.

    `new NodeRange( $from: ResolvedPos, $to: ResolvedPos, depth: number )`
    :   Construct a node range. `$from` and `$to` should point into the
        same node until at least the given `depth`, since a node range
        denotes an adjacent set of nodes in a single parent node.

    `$from: ResolvedPos`
    :   A resolved position along the start of the content. May have a
        `depth` greater than this object's `depth` property, since
        these are the positions that were used to compute the range,
        not re-resolved positions directly at its boundaries.

    `$to: ResolvedPos`
    :   A position along the end of the content. See
        caveat for [`$from`](#model.NodeRange.$from).

    `depth: number`
    :   The depth of the node that this range points into.

    `start: number`
    :   The position at the start of the range.

    `end: number`
    :   The position at the end of the range.

    `parent: Node`
    :   The parent node that the range points into.

    `startIndex: number`
    :   The start index of the range in the parent node.

    `endIndex: number`
    :   The end index of the range in the parent node.

### [Document Schema](#model.Document_Schema)

Every ProseMirror document conforms to a
[schema](/docs/guide/#schema), which describes the set of nodes and
marks that it is made out of, along with the relations between those,
such as which node may occur as a child node of which other nodes.

#### `class` [Schema](#model.Schema)`<Nodes extends string = any, Marks extends string = any>`
:   A document schema. Holds [node](#model.NodeType) and [mark
    type](#model.MarkType) objects for the nodes and marks that may
    occur in conforming documents, and provides functionality for
    creating and deserializing such documents.

    When given, the type parameters provide the names of the nodes and
    marks in this schema.

    `new Schema(spec: SchemaSpec<Nodes, Marks>)`
    :   Construct a schema from a schema [specification](#model.SchemaSpec).

    `spec: { nodes: OrderedMap<NodeSpec>, marks: OrderedMap<MarkSpec>, topNode⁠?: string }`
    :   The [spec](#model.SchemaSpec) on which the schema is based,
        with the added guarantee that its `nodes` and `marks`
        properties are
        [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
        (not raw objects).

    `nodes: {[name in Nodes]: NodeType} & Object<NodeType>`
    :   An object mapping the schema's node names to node type objects.

    `marks: {[name in Marks]: MarkType} & Object<MarkType>`
    :   A map from mark names to mark type objects.

    `linebreakReplacement: NodeType | null`
    :   The [linebreak
        replacement](#model.NodeSpec.linebreakReplacement) node defined
        in this schema, if any.

    `topNodeType: NodeType`
    :   The type of the [default top node](#model.SchemaSpec.topNode)
        for this schema.

    `cached: Object<any>`
    :   An object for storing whatever values modules may want to
        compute and cache per schema. (If you want to store something
        in it, try to use property names unlikely to clash.)

    `node( type: string | NodeType, attrs⁠?: Attrs | null = null, content⁠?: Fragment | Node | readonly Node[], marks⁠?: readonly Mark[] ) → Node`
    :   Create a node in this schema. The `type` may be a string or a
        `NodeType` instance. Attributes will be extended with defaults,
        `content` may be a `Fragment`, `null`, a `Node`, or an array of
        nodes.

    `text(text: string, marks⁠?: readonly Mark[]) → Node`
    :   Create a text node in the schema. Empty text nodes are not
        allowed.

    `mark(type: string | MarkType, attrs⁠?: Attrs) → Mark`
    :   Create a mark with the given type and attributes.

    `nodeFromJSON(json: any) → Node`
    :   Deserialize a node from its JSON representation. This method is
        bound.

    `markFromJSON(json: any) → Mark`
    :   Deserialize a mark from its JSON representation. This method is
        bound.

#### `interface` [SchemaSpec](#model.SchemaSpec)`<Nodes extends string = any, Marks extends string = any>`
:   An object describing a schema, as passed to the [`Schema`](#model.Schema)
    constructor.

    `nodes: {[name in Nodes]: NodeSpec} | OrderedMap<NodeSpec>`
    :   The node types in this schema. Maps names to
        [`NodeSpec`](#model.NodeSpec) objects that describe the node type
        associated with that name. Their order is significant—it
        determines which [parse rules](#model.NodeSpec.parseDOM) take
        precedence by default, and which nodes come first in a given
        [group](#model.NodeSpec.group).

    `marks⁠?: {[name in Marks]: MarkSpec} | OrderedMap<MarkSpec>`
    :   The mark types that exist in this schema. The order in which they
        are provided determines the order in which [mark
        sets](#model.Mark.addToSet) are sorted and in which [parse
        rules](#model.MarkSpec.parseDOM) are tried.

    `topNode⁠?: string`
    :   The name of the default top-level node for the schema. Defaults
        to `"doc"`.

#### `interface` [NodeSpec](#model.NodeSpec)
:   A description of a node type, used when defining a schema.

    `content⁠?: string`
    :   The content expression for this node, as described in the [schema
        guide](/docs/guide/#schema.content_expressions). When not given,
        the node does not allow any content.

    `marks⁠?: string`
    :   The marks that are allowed inside of this node. May be a
        space-separated string referring to mark names or groups, `"_"`
        to explicitly allow all marks, or `""` to disallow marks. When
        not given, nodes with inline content default to allowing all
        marks, other nodes default to not allowing marks.

    `group⁠?: string`
    :   The group or space-separated groups to which this node belongs,
        which can be referred to in the content expressions for the
        schema.

    `inline⁠?: boolean`
    :   Should be set to true for inline nodes. (Implied for text nodes.)

    `atom⁠?: boolean`
    :   Can be set to true to indicate that, though this isn't a [leaf
        node](#model.NodeType.isLeaf), it doesn't have directly editable
        content and should be treated as a single unit in the view.

    `attrs⁠?: Object<AttributeSpec>`
    :   The attributes that nodes of this type get.

    `selectable⁠?: boolean`
    :   Controls whether nodes of this type can be selected as a [node
        selection](#state.NodeSelection). Defaults to true for non-text
        nodes.

    `draggable⁠?: boolean`
    :   Determines whether nodes of this type can be dragged without
        being selected. Defaults to false.

    `code⁠?: boolean`
    :   Can be used to indicate that this node contains code, which
        causes some commands to behave differently.

    `whitespace⁠?: "pre" | "normal"`
    :   Controls way whitespace in this a node is parsed. The default is
        `"normal"`, which causes the [DOM parser](#model.DOMParser) to
        collapse whitespace in normal mode, and normalize it (replacing
        newlines and such with spaces) otherwise. `"pre"` causes the
        parser to preserve spaces inside the node. When this option isn't
        given, but [`code`](#model.NodeSpec.code) is true, `whitespace`
        will default to `"pre"`. Note that this option doesn't influence
        the way the node is rendered—that should be handled by `toDOM`
        and/or styling.

    `definingAsContext⁠?: boolean`
    :   Determines whether this node is considered an important parent
        node during replace operations (such as paste). Non-defining (the
        default) nodes get dropped when their entire content is replaced,
        whereas defining nodes persist and wrap the inserted content.

    `definingForContent⁠?: boolean`
    :   In inserted content the defining parents of the content are
        preserved when possible. Typically, non-default-paragraph
        textblock types, and possibly list items, are marked as defining.

    `defining⁠?: boolean`
    :   When enabled, enables both
        [`definingAsContext`](#model.NodeSpec.definingAsContext) and
        [`definingForContent`](#model.NodeSpec.definingForContent).

    `isolating⁠?: boolean`
    :   When enabled (default is false), the sides of nodes of this type
        count as boundaries that regular editing operations, like
        backspacing or lifting, won't cross. An example of a node that
        should probably have this enabled is a table cell.

    `toDOM⁠?: fn(node: Node) → DOMOutputSpec`
    :   Defines the default way a node of this type should be serialized
        to DOM/HTML (as used by
        [`DOMSerializer.fromSchema`](#model.DOMSerializer%5EfromSchema)).
        Should return a DOM node or an [array
        structure](#model.DOMOutputSpec) that describes one, with an
        optional number zero (“hole”) in it to indicate where the node's
        content should be inserted.

        For text nodes, the default is to create a text DOM node. Though
        it is possible to create a serializer where text is rendered
        differently, this is not supported inside the editor, so you
        shouldn't override that in your text node spec.

    `parseDOM⁠?: readonly TagParseRule[]`
    :   Associates DOM parser information with this node, which can be
        used by [`DOMParser.fromSchema`](#model.DOMParser%5EfromSchema) to
        automatically derive a parser. The `node` field in the rules is
        implied (the name of this node will be filled in automatically).
        If you supply your own parser, you do not need to also specify
        parsing rules in your schema.

    `toDebugString⁠?: fn(node: Node) → string`
    :   Defines the default way a node of this type should be serialized
        to a string representation for debugging (e.g. in error messages).

    `leafText⁠?: fn(node: Node) → string`
    :   Defines the default way a [leaf node](#model.NodeType.isLeaf) of
        this type should be serialized to a string (as used by
        [`Node.textBetween`](#model.Node.textBetween) and
        [`Node.textContent`](#model.Node.textContent)).

    `linebreakReplacement⁠?: boolean`
    :   A single inline node in a schema can be set to be a linebreak
        equivalent. When converting between block types that support the
        node and block types that don't but have
        [`whitespace`](#model.NodeSpec.whitespace) set to `"pre"`,
        [`setBlockType`](#transform.Transform.setBlockType) will convert
        between newline characters to or from linebreak nodes as
        appropriate.

    `[string]: any`
    :   Node specs may include arbitrary properties that can be read by
        other code via [`NodeType.spec`](#model.NodeType.spec).

#### `interface` [MarkSpec](#model.MarkSpec)
:   Used to define marks when creating a schema.

    `attrs⁠?: Object<AttributeSpec>`
    :   The attributes that marks of this type get.

    `inclusive⁠?: boolean`
    :   Whether this mark should be active when the cursor is positioned
        at its end (or at its start when that is also the start of the
        parent node). Defaults to true.

    `excludes⁠?: string`
    :   Determines which other marks this mark can coexist with. Should
        be a space-separated strings naming other marks or groups of marks.
        When a mark is [added](#model.Mark.addToSet) to a set, all marks
        that it excludes are removed in the process. If the set contains
        any mark that excludes the new mark but is not, itself, excluded
        by the new mark, the mark can not be added an the set. You can
        use the value `"_"` to indicate that the mark excludes all
        marks in the schema.

        Defaults to only being exclusive with marks of the same type. You
        can set it to an empty string (or any string not containing the
        mark's own name) to allow multiple marks of a given type to
        coexist (as long as they have different attributes).

    `group⁠?: string`
    :   The group or space-separated groups to which this mark belongs.

    `spanning⁠?: boolean`
    :   Determines whether marks of this type can span multiple adjacent
        nodes when serialized to DOM/HTML. Defaults to true.

    `code⁠?: boolean`
    :   Marks the content of this span as being code, which causes some
        commands and extensions to treat it differently.

    `toDOM⁠?: fn(mark: Mark, inline: boolean) → DOMOutputSpec`
    :   Defines the default way marks of this type should be serialized
        to DOM/HTML. When the resulting spec contains a hole, that is
        where the marked content is placed. Otherwise, it is appended to
        the top node.

    `parseDOM⁠?: readonly ParseRule[]`
    :   Associates DOM parser information with this mark (see the
        corresponding [node spec field](#model.NodeSpec.parseDOM)). The
        `mark` field in the rules is implied.

    `[string]: any`
    :   Mark specs can include additional properties that can be
        inspected through [`MarkType.spec`](#model.MarkType.spec) when
        working with the mark.

#### `interface` [AttributeSpec](#model.AttributeSpec)
:   Used to [define](#model.NodeSpec.attrs) attributes on nodes or
    marks.

    `default⁠?: any`
    :   The default value for this attribute, to use when no explicit
        value is provided. Attributes that have no default must be
        provided whenever a node or mark of a type that has them is
        created.

    `validate⁠?: string | fn(value: any)`
    :   A function or type name used to validate values of this
        attribute. This will be used when deserializing the attribute
        from JSON, and when running [`Node.check`](#model.Node.check).
        When a function, it should raise an exception if the value isn't
        of the expected type or shape. When a string, it should be a
        `|`-separated string of primitive types (`"number"`, `"string"`,
        `"boolean"`, `"null"`, and `"undefined"`), and the library will
        raise an error when the value is not one of those types.

#### `class` [NodeType](#model.NodeType)
:   Node types are objects allocated once per `Schema` and used to
    [tag](#model.Node.type) `Node` instances. They contain information
    about the node type, such as its name and what kind of node it
    represents.

    `name: string`
    :   The name the node type has in this schema.

    `schema: Schema`
    :   A link back to the `Schema` the node type belongs to.

    `spec: NodeSpec`
    :   The spec that this type is based on

    `inlineContent: boolean`
    :   True if this node type has inline content.

    `isBlock: boolean`
    :   True if this is a block type

    `isText: boolean`
    :   True if this is the text node type.

    `isInline: boolean`
    :   True if this is an inline type.

    `isTextblock: boolean`
    :   True if this is a textblock type, a block that contains inline
        content.

    `isLeaf: boolean`
    :   True for node types that allow no content.

    `isAtom: boolean`
    :   True when this node is an atom, i.e. when it does not have
        directly editable content.

    `isInGroup(group: string) → boolean`
    :   Return true when this node type is part of the given
        [group](#model.NodeSpec.group).

    `contentMatch: ContentMatch`
    :   The starting match of the node type's content expression.

    `markSet: readonly MarkType[] | null`
    :   The set of marks allowed in this node. `null` means all marks
        are allowed.

    `whitespace: "pre" | "normal"`
    :   The node type's [whitespace](#model.NodeSpec.whitespace) option.

    `hasRequiredAttrs() → boolean`
    :   Tells you whether this node type has any required attributes.

    `compatibleContent(other: NodeType) → boolean`
    :   Indicates whether this node allows some of the same content as
        the given node type.

    `create( attrs⁠?: Attrs | null = null, content⁠?: Fragment | Node | readonly Node[] | null, marks⁠?: readonly Mark[] ) → Node`
    :   Create a `Node` of this type. The given attributes are
        checked and defaulted (you can pass `null` to use the type's
        defaults entirely, if no required attributes exist). `content`
        may be a `Fragment`, a node, an array of nodes, or
        `null`. Similarly `marks` may be `null` to default to the empty
        set of marks.

    `createChecked( attrs⁠?: Attrs | null = null, content⁠?: Fragment | Node | readonly Node[] | null, marks⁠?: readonly Mark[] ) → Node`
    :   Like [`create`](#model.NodeType.create), but check the given content
        against the node type's content restrictions, and throw an error
        if it doesn't match.

    `createAndFill( attrs⁠?: Attrs | null = null, content⁠?: Fragment | Node | readonly Node[] | null, marks⁠?: readonly Mark[] ) → Node | null`
    :   Like [`create`](#model.NodeType.create), but see if it is
        necessary to add nodes to the start or end of the given fragment
        to make it fit the node. If no fitting wrapping can be found,
        return null. Note that, due to the fact that required nodes can
        always be created, this will always succeed if you pass null or
        `Fragment.empty` as content.

    `validContent(content: Fragment) → boolean`
    :   Returns true if the given fragment is valid content for this node
        type.

    `allowsMarkType(markType: MarkType) → boolean`
    :   Check whether the given mark type is allowed in this node.

    `allowsMarks(marks: readonly Mark[]) → boolean`
    :   Test whether the given set of marks are allowed in this node.

    `allowedMarks(marks: readonly Mark[]) → readonly Mark[]`
    :   Removes the marks that are not allowed in this node from the given set.

#### `class` [MarkType](#model.MarkType)
:   Like nodes, marks (which are associated with nodes to signify
    things like emphasis or being part of a link) are
    [tagged](#model.Mark.type) with type objects, which are
    instantiated once per `Schema`.

    `name: string`
    :   The name of the mark type.

    `schema: Schema`
    :   The schema that this mark type instance is part of.

    `spec: MarkSpec`
    :   The spec on which the type is based.

    `create(attrs⁠?: Attrs | null = null) → Mark`
    :   Create a mark of this type. `attrs` may be `null` or an object
        containing only some of the mark's attributes. The others, if
        they have defaults, will be added.

    `removeFromSet(set: readonly Mark[]) → readonly Mark[]`
    :   When there is a mark of this type in the given set, a new set
        without it is returned. Otherwise, the input set is returned.

    `isInSet(set: readonly Mark[]) → Mark | undefined`
    :   Tests whether there is a mark of this type in the given set.

    `excludes(other: MarkType) → boolean`
    :   Queries whether a given mark type is
        [excluded](#model.MarkSpec.excludes) by this one.

#### `class` [ContentMatch](#model.ContentMatch)
:   Instances of this class represent a match state of a node type's
    [content expression](#model.NodeSpec.content), and can be used to
    find out whether further content matches here, and whether a given
    position is a valid end of the node.

    `validEnd: boolean`
    :   True when this match state represents a valid end of the node.

    `matchType(type: NodeType) → ContentMatch | null`
    :   Match a node type, returning a match after that node if
        successful.

    `matchFragment( frag: Fragment, start⁠?: number = 0, end⁠?: number = frag.childCount ) → ContentMatch | null`
    :   Try to match a fragment. Returns the resulting match when
        successful.

    `defaultType: NodeType | null`
    :   Get the first matching node type at this match position that can
        be generated.

    `fillBefore( after: Fragment, toEnd⁠?: boolean = false, startIndex⁠?: number = 0 ) → Fragment | null`
    :   Try to match the given fragment, and if that fails, see if it can
        be made to match by inserting nodes in front of it. When
        successful, return a fragment of inserted nodes (which may be
        empty if nothing had to be inserted). When `toEnd` is true, only
        return a fragment if the resulting match goes to the end of the
        content expression.

    `findWrapping(target: NodeType) → readonly NodeType[] | null`
    :   Find a set of wrapping node types that would allow a node of the
        given type to appear at this position. The result may be empty
        (when it fits directly) and will be null when no such wrapping
        exists.

    `edgeCount: number`
    :   The number of outgoing edges this node has in the finite
        automaton that describes the content expression.

    `edge(n: number) → {type: NodeType, next: ContentMatch}`
    :   Get the \_n\_​th outgoing edge from this node in the finite
        automaton that describes the content expression.

### [DOM Representation](#model.DOM_Representation)

Because representing a document as a tree of DOM nodes is central to
the way ProseMirror operates, DOM [parsing](#model.DOMParser) and
[serializing](#model.DOMSerializer) is integrated with the model.

(But note that you do *not* need to have a DOM implementation loaded
to use this module.)

#### `class` [DOMParser](#model.DOMParser)
:   A DOM parser represents a strategy for parsing DOM content into a
    ProseMirror document conforming to a given schema. Its behavior is
    defined by an array of [rules](#model.ParseRule).

    `new DOMParser( schema: Schema, rules: readonly ParseRule[] )`
    :   Create a parser that targets the given schema, using the given
        parsing rules.

    `schema: Schema`
    :   The schema into which the parser parses.

    `rules: readonly ParseRule[]`
    :   The set of [parse rules](#model.ParseRule) that the parser
        uses, in order of precedence.

    `parse(dom: DOMNode, options⁠?: ParseOptions = {}) → Node`
    :   Parse a document from the content of a DOM node.

    `parseSlice(dom: DOMNode, options⁠?: ParseOptions = {}) → Slice`
    :   Parses the content of the given DOM node, like
        [`parse`](#model.DOMParser.parse), and takes the same set of
        options. But unlike that method, which produces a whole node,
        this one returns a slice that is open at the sides, meaning that
        the schema constraints aren't applied to the start of nodes to
        the left of the input and the end of nodes at the end.

    `static fromSchema(schema: Schema) → DOMParser`
    :   Construct a DOM parser using the parsing rules listed in a
        schema's [node specs](#model.NodeSpec.parseDOM), reordered by
        [priority](#model.GenericParseRule.priority).

#### `interface` [ParseOptions](#model.ParseOptions)
:   These are the options recognized by the
    [`parse`](#model.DOMParser.parse) and
    [`parseSlice`](#model.DOMParser.parseSlice) methods.

    `preserveWhitespace⁠?: boolean | "full"`
    :   By default, whitespace is collapsed as per HTML's rules. Pass
        `true` to preserve whitespace, but normalize newlines to
        spaces or, if available, [line break replacements](#model.NodeSpec.linebreakReplacement),
        and `"full"` to preserve whitespace entirely.

    `findPositions⁠?: {node: DOMNode, offset: number, pos⁠?: number}[]`
    :   When given, the parser will, beside parsing the content,
        record the document positions of the given DOM positions. It
        will do so by writing to the objects, adding a `pos` property
        that holds the document position. DOM positions that are not
        in the parsed content will not be written to.

    `from⁠?: number`
    :   The child node index to start parsing from.

    `to⁠?: number`
    :   The child node index to stop parsing at.

    `topNode⁠?: Node`
    :   By default, the content is parsed into the schema's default
        [top node type](#model.Schema.topNodeType). You can pass this
        option to use the type and attributes from a different node
        as the top container.

    `topMatch⁠?: ContentMatch`
    :   Provide the starting content match that content parsed into the
        top node is matched against.

    `context⁠?: ResolvedPos`
    :   A set of additional nodes to count as
        [context](#model.GenericParseRule.context) when parsing, above the
        given [top node](#model.ParseOptions.topNode).

#### `interface` [GenericParseRule](#model.GenericParseRule)
:   Fields that may be present in both [tag](#model.TagParseRule) and
    [style](#model.StyleParseRule) parse rules.

    `priority⁠?: number`
    :   Can be used to change the order in which the parse rules in a
        schema are tried. Those with higher priority come first. Rules
        without a priority are counted as having priority 50. This
        property is only meaningful in a schema—when directly
        constructing a parser, the order of the rule array is used.

    `consuming⁠?: boolean`
    :   By default, when a rule matches an element or style, no further
        rules get a chance to match it. By setting this to `false`, you
        indicate that even when this rule matches, other rules that come
        after it should also run.

    `context⁠?: string`
    :   When given, restricts this rule to only match when the current
        context—the parent nodes into which the content is being
        parsed—matches this expression. Should contain one or more node
        names or node group names followed by single or double slashes.
        For example `"paragraph/"` means the rule only matches when the
        parent node is a paragraph, `"blockquote/paragraph/"` restricts
        it to be in a paragraph that is inside a blockquote, and
        `"section//"` matches any position inside a section—a double
        slash matches any sequence of ancestor nodes. To allow multiple
        different contexts, they can be separated by a pipe (`|`)
        character, as in `"blockquote/|list_item/"`.

    `mark⁠?: string`
    :   The name of the mark type to wrap the matched content in.

    `ignore⁠?: boolean`
    :   When true, ignore content that matches this rule.

    `closeParent⁠?: boolean`
    :   When true, finding an element that matches this rule will close
        the current node.

    `skip⁠?: boolean`
    :   When true, ignore the node that matches this rule, but do parse
        its content.

    `attrs⁠?: Attrs`
    :   Attributes for the node or mark created by this rule. When
        `getAttrs` is provided, it takes precedence.

#### `interface` [TagParseRule](#model.TagParseRule) `extends GenericParseRule`
:   Parse rule targeting a DOM element.

    `tag: string`
    :   A CSS selector describing the kind of DOM elements to match.

    `namespace⁠?: string`
    :   The namespace to match. Nodes are only matched when the
        namespace matches or this property is null.

    `node⁠?: string`
    :   The name of the node type to create when this rule matches. Each
        rule should have either a `node`, `mark`, or `ignore` property
        (except when it appears in a [node](#model.NodeSpec.parseDOM) or
        [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
        or `mark` property will be derived from its position).

    `getAttrs⁠?: fn(node: HTMLElement) → false | Attrs | null`
    :   A function used to compute the attributes for the node or mark
        created by this rule. Can also be used to describe further
        conditions the DOM element or style must match. When it returns
        `false`, the rule won't match. When it returns null or undefined,
        that is interpreted as an empty/default set of attributes.

    `contentElement⁠?: string | HTMLElement | fn(node: HTMLElement) → HTMLElement`
    :   For rules that produce non-leaf nodes, by default the content of
        the DOM element is parsed as content of the node. If the child
        nodes are in a descendent node, this may be a CSS selector
        string that the parser must use to find the actual content
        element, or a function that returns the actual content element
        to the parser.

    `getContent⁠?: fn(node: DOMNode, schema: Schema) → Fragment`
    :   Can be used to override the content of a matched node. When
        present, instead of parsing the node's child nodes, the result of
        this function is used.

    `preserveWhitespace⁠?: boolean | "full"`
    :   Controls whether whitespace should be preserved when parsing the
        content inside the matched element. `false` means whitespace may
        be collapsed, `true` means that whitespace should be preserved
        but newlines normalized to spaces, and `"full"` means that
        newlines should also be preserved.

#### `interface` [StyleParseRule](#model.StyleParseRule) `extends GenericParseRule`
:   A parse rule targeting a style property.

    `style: string`
    :   A CSS property name to match. This rule will match inline styles
        that list that property. May also have the form
        `"property=value"`, in which case the rule only matches if the
        property's value exactly matches the given value. (For more
        complicated filters, use [`getAttrs`](#model.StyleParseRule.getAttrs)
        and return false to indicate that the match failed.) Rules
        matching styles may only produce [marks](#model.GenericParseRule.mark),
        not nodes.

    `clearMark⁠?: fn(mark: Mark) → boolean`
    :   Style rules can remove marks from the set of active marks.

    `getAttrs⁠?: fn(node: string) → false | Attrs | null`
    :   A function used to compute the attributes for the node or mark
        created by this rule. Called with the style's value.

`type ParseRule = TagParseRule | StyleParseRule`
:   A value that describes how to parse a given DOM node or inline
    style as a ProseMirror node or mark.

#### `class` [DOMSerializer](#model.DOMSerializer)
:   A DOM serializer knows how to convert ProseMirror nodes and
    marks of various types to DOM nodes.

    `new DOMSerializer( nodes: Object<fn(node: Node) → DOMOutputSpec>, marks: Object< fn(mark: Mark, inline: boolean) → DOMOutputSpec > )`
    :   Create a serializer. `nodes` should map node names to functions
        that take a node and return a description of the corresponding
        DOM. `marks` does the same for mark names, but also gets an
        argument that tells it whether the mark's content is block or
        inline content (for typical use, it'll always be inline). A mark
        serializer may be `null` to indicate that marks of that type
        should not be serialized.

    `nodes: Object<fn(node: Node) → DOMOutputSpec>`
    :   The node serialization functions.

    `marks: Object< fn(mark: Mark, inline: boolean) → DOMOutputSpec >`
    :   The mark serialization functions.

    `serializeFragment( fragment: Fragment, options⁠?: {document⁠?: Document} = {}, target⁠?: HTMLElement | DocumentFragment ) → HTMLElement | DocumentFragment`
    :   Serialize the content of this fragment to a DOM fragment. When
        not in the browser, the `document` option, containing a DOM
        document, should be passed so that the serializer can create
        nodes.

    `serializeNode( node: Node, options⁠?: {document⁠?: Document} = {} ) → DOMNode`
    :   Serialize this node to a DOM node. This can be useful when you
        need to serialize a part of a document, as opposed to the whole
        document. To serialize a whole document, use
        [`serializeFragment`](#model.DOMSerializer.serializeFragment) on
        its [content](#model.Node.content).

    `static renderSpec( doc: Document, structure: DOMOutputSpec, xmlNS⁠?: string ) → {dom: DOMNode, contentDOM⁠?: HTMLElement}`
    :   Render an [output spec](#model.DOMOutputSpec) to a DOM node. If
        the spec has a hole (zero) in it, `contentDOM` will point at the
        node with the hole.

    `static fromSchema(schema: Schema) → DOMSerializer`
    :   Build a serializer using the [`toDOM`](#model.NodeSpec.toDOM)
        properties in a schema's node and mark specs.

    `static nodesFromSchema(schema: Schema) → Object<fn(node: Node) → DOMOutputSpec>`
    :   Gather the serializers in a schema's node specs into an object.
        This can be useful as a base to build a custom serializer from.

    `static marksFromSchema(schema: Schema) → Object< fn(mark: Mark, inline: boolean) → DOMOutputSpec >`
    :   Gather the serializers in a schema's mark specs into an object.

`type DOMOutputSpec = string | DOMNode | {dom: DOMNode, contentDOM⁠?: HTMLElement} | [string, any]`
:   A description of a DOM structure. Can be either a string, which is
    interpreted as a text node, a DOM node, which is interpreted as
    itself, a `{dom, contentDOM}` object, or an array.

    An array describes a DOM element. The first value in the array
    should be a string—the name of the DOM element, optionally prefixed
    by a namespace URL and a space. If the second element is plain
    object, it is interpreted as a set of attributes for the element.
    Any elements after that (including the 2nd if it's not an attribute
    object) are interpreted as children of the DOM elements, and must
    either be valid `DOMOutputSpec` values, or the number zero.

    The number zero (pronounced “hole”) is used to indicate the place
    where a node's child nodes should be inserted. If it occurs in an
    output spec, it should be the only child element in its parent
    node.

[prosemirror-transform module](#transform)
------------------------------------------

This module defines a way of modifying documents that allows changes
to be recorded, replayed, and reordered. You can read more about
transformations in [the guide](/docs/guide/#transform).

### [Steps](#transform.Steps)

Transforming happens in `Step`s, which are atomic, well-defined
modifications to a document. [Applying](#transform.Step.apply) a step
produces a new document.

Each step provides a [change map](#transform.StepMap) that maps
positions in the old document to position in the transformed document.
Steps can be [inverted](#transform.Step.invert) to create a step that
undoes their effect, and chained together in a convenience object
called a [`Transform`](#transform.Transform).

#### `abstract class` [Step](#transform.Step)
:   A step object represents an atomic change. It generally applies
    only to the document it was created for, since the positions
    stored in it will only make sense for that document.

    New steps are defined by creating classes that extend `Step`,
    overriding the `apply`, `invert`, `map`, `getMap` and `fromJSON`
    methods, and registering your class with a unique
    JSON-serialization identifier using
    [`Step.jsonID`](#transform.Step%5EjsonID).

    `abstract apply(doc: Node) → StepResult`
    :   Applies this step to the given document, returning a result
        object that either indicates failure, if the step can not be
        applied to this document, or indicates success by containing a
        transformed document.

    `getMap() → StepMap`
    :   Get the step map that represents the changes made by this step,
        and which can be used to transform between positions in the old
        and the new document.

    `abstract invert(doc: Node) → Step`
    :   Create an inverted version of this step. Needs the document as it
        was before the step as argument.

    `abstract map(mapping: Mappable) → Step | null`
    :   Map this step through a mappable thing, returning either a
        version of that step with its positions adjusted, or `null` if
        the step was entirely deleted by the mapping.

    `merge(other: Step) → Step | null`
    :   Try to merge this step with another one, to be applied directly
        after it. Returns the merged step when possible, null if the
        steps can't be merged.

    `abstract toJSON() → any`
    :   Create a JSON-serializeable representation of this step. When
        defining this for a custom subclass, make sure the result object
        includes the step type's [JSON id](#transform.Step%5EjsonID) under
        the `stepType` property.

    `static fromJSON(schema: Schema, json: any) → Step`
    :   Deserialize a step from its JSON representation. Will call
        through to the step class' own implementation of this method.

    `static jsonID( id: string, stepClass: {fromJSON: fn(schema: Schema, json: any) → Step} ) → {fromJSON: fn(schema: Schema, json: any) → Step}`
    :   To be able to serialize steps to JSON, each step needs a string
        ID to attach to its JSON representation. Use this method to
        register an ID for your step classes. Try to pick something
        that's unlikely to clash with steps from other modules.

#### `class` [StepResult](#transform.StepResult)
:   The result of [applying](#transform.Step.apply) a step. Contains either a
    new document or a failure value.

    `doc: Node | null`
    :   The transformed document, if successful.

    `failed: string | null`
    :   The failure message, if unsuccessful.

    `static ok(doc: Node) → StepResult`
    :   Create a successful step result.

    `static fail(message: string) → StepResult`
    :   Create a failed step result.

    `static fromReplace( doc: Node, from: number, to: number, slice: Slice ) → StepResult`
    :   Call [`Node.replace`](#model.Node.replace) with the given
        arguments. Create a successful result if it succeeds, and a
        failed one if it throws a `ReplaceError`.

#### `class` [ReplaceStep](#transform.ReplaceStep) `extends Step`
:   Replace a part of the document with a slice of new content.

    `new ReplaceStep( from: number, to: number, slice: Slice, structure⁠?: boolean = false )`
    :   The given `slice` should fit the 'gap' between `from` and
        `to`—the depths must line up, and the surrounding nodes must be
        able to be joined with the open sides of the slice. When
        `structure` is true, the step will fail if the content between
        from and to is not just a sequence of closing and then opening
        tokens (this is to guard against rebased replace steps
        overwriting something they weren't supposed to).

    `from: number`
    :   The start position of the replaced range.

    `to: number`
    :   The end position of the replaced range.

    `slice: Slice`
    :   The slice to insert.

#### `class` [ReplaceAroundStep](#transform.ReplaceAroundStep) `extends Step`
:   Replace a part of the document with a slice of content, but
    preserve a range of the replaced content by moving it into the
    slice.

    `new ReplaceAroundStep( from: number, to: number, gapFrom: number, gapTo: number, slice: Slice, insert: number, structure⁠?: boolean = false )`
    :   Create a replace-around step with the given range and gap.
        `insert` should be the point in the slice into which the content
        of the gap should be moved. `structure` has the same meaning as
        it has in the [`ReplaceStep`](#transform.ReplaceStep) class.

    `from: number`
    :   The start position of the replaced range.

    `to: number`
    :   The end position of the replaced range.

    `gapFrom: number`
    :   The start of preserved range.

    `gapTo: number`
    :   The end of preserved range.

    `slice: Slice`
    :   The slice to insert.

    `insert: number`
    :   The position in the slice where the preserved range should be
        inserted.

#### `class` [AddMarkStep](#transform.AddMarkStep) `extends Step`
:   Add a mark to all inline content between two positions.

    `new AddMarkStep(from: number, to: number, mark: Mark)`
    :   Create a mark step.

    `from: number`
    :   The start of the marked range.

    `to: number`
    :   The end of the marked range.

    `mark: Mark`
    :   The mark to add.

#### `class` [RemoveMarkStep](#transform.RemoveMarkStep) `extends Step`
:   Remove a mark from all inline content between two positions.

    `new RemoveMarkStep(from: number, to: number, mark: Mark)`
    :   Create a mark-removing step.

    `from: number`
    :   The start of the unmarked range.

    `to: number`
    :   The end of the unmarked range.

    `mark: Mark`
    :   The mark to remove.

#### `class` [AddNodeMarkStep](#transform.AddNodeMarkStep) `extends Step`
:   Add a mark to a specific node.

    `new AddNodeMarkStep(pos: number, mark: Mark)`
    :   Create a node mark step.

    `pos: number`
    :   The position of the target node.

    `mark: Mark`
    :   The mark to add.

#### `class` [RemoveNodeMarkStep](#transform.RemoveNodeMarkStep) `extends Step`
:   Remove a mark from a specific node.

    `new RemoveNodeMarkStep(pos: number, mark: Mark)`
    :   Create a mark-removing step.

    `pos: number`
    :   The position of the target node.

    `mark: Mark`
    :   The mark to remove.

#### `class` [AttrStep](#transform.AttrStep) `extends Step`
:   Update an attribute in a specific node.

    `new AttrStep(pos: number, attr: string, value: any)`
    :   Construct an attribute step.

    `pos: number`
    :   The position of the target node.

    `attr: string`
    :   The attribute to set.

    `value: any`


    `static fromJSON(schema: Schema, json: any) → AttrStep`

#### `class` [DocAttrStep](#transform.DocAttrStep) `extends Step`
:   Update an attribute in the doc node.

    `new DocAttrStep(attr: string, value: any)`
    :   Construct an attribute step.

    `attr: string`
    :   The attribute to set.

    `value: any`


    `static fromJSON(schema: Schema, json: any) → DocAttrStep`

### [Position Mapping](#transform.Position_Mapping)

Mapping positions from one document to another by running through the
[step maps](#transform.StepMap) produced by steps is an important
operation in ProseMirror. It is used, for example, for updating the
selection when the document changes.

#### `interface` [Mappable](#transform.Mappable)
:   There are several things that positions can be mapped through.
    Such objects conform to this interface.

    `map(pos: number, assoc⁠?: number) → number`
    :   Map a position through this object. When given, `assoc` (should
        be -1 or 1, defaults to 1) determines with which side the
        position is associated, which determines in which direction to
        move when a chunk of content is inserted at the mapped position.

    `mapResult(pos: number, assoc⁠?: number) → MapResult`
    :   Map a position, and return an object containing additional
        information about the mapping. The result's `deleted` field tells
        you whether the position was deleted (completely enclosed in a
        replaced range) during the mapping. When content on only one side
        is deleted, the position itself is only considered deleted when
        `assoc` points in the direction of the deleted content.

#### `class` [MapResult](#transform.MapResult)
:   An object representing a mapped position with extra
    information.

    `pos: number`
    :   The mapped version of the position.

    `deleted: boolean`
    :   Tells you whether the position was deleted, that is, whether the
        step removed the token on the side queried (via the `assoc`)
        argument from the document.

    `deletedBefore: boolean`
    :   Tells you whether the token before the mapped position was deleted.

    `deletedAfter: boolean`
    :   True when the token after the mapped position was deleted.

    `deletedAcross: boolean`
    :   Tells whether any of the steps mapped through deletes across the
        position (including both the token before and after the
        position).

#### `class` [StepMap](#transform.StepMap) `implements Mappable`
:   A map describing the deletions and insertions made by a step, which
    can be used to find the correspondence between positions in the
    pre-step version of a document and the same position in the
    post-step version.

    `new StepMap( ranges: readonly number[], inverted⁠?: boolean = false )`
    :   Create a position map. The modifications to the document are
        represented as an array of numbers, in which each group of three
        represents a modified chunk as `[start, oldSize, newSize]`.

    `forEach( f: fn( oldStart: number, oldEnd: number, newStart: number, newEnd: number ) )`
    :   Calls the given function on each of the changed ranges included in
        this map.

    `invert() → StepMap`
    :   Create an inverted version of this map. The result can be used to
        map positions in the post-step document to the pre-step document.

    `static offset(n: number) → StepMap`
    :   Create a map that moves all positions by offset `n` (which may be
        negative). This can be useful when applying steps meant for a
        sub-document to a larger document, or vice-versa.

    `static empty: StepMap`
    :   A StepMap that contains no changed ranges.

#### `class` [Mapping](#transform.Mapping) `implements Mappable`
:   A mapping represents a pipeline of zero or more [step
    maps](#transform.StepMap). It has special provisions for losslessly
    handling mapping positions through a series of steps in which some
    steps are inverted versions of earlier steps. (This comes up when
    ‘[rebasing](/docs/guide/#transform.rebasing)’ steps for
    collaboration or history management.)

    `new Mapping( maps⁠?: readonly StepMap[], mirror⁠?: number[], from⁠?: number = 0, to⁠?: number = maps ? maps.length : 0 )`
    :   Create a new mapping with the given position maps.

    `from: number`
    :   The starting position in the `maps` array, used when `map` or
        `mapResult` is called.

    `to: number`
    :   The end position in the `maps` array.

    `maps: readonly StepMap[]`
    :   The step maps in this mapping.

    `slice( from⁠?: number = 0, to⁠?: number = this.maps.length ) → Mapping`
    :   Create a mapping that maps only through a part of this one.

    `appendMap(map: StepMap, mirrors⁠?: number)`
    :   Add a step map to the end of this mapping. If `mirrors` is
        given, it should be the index of the step map that is the mirror
        image of this one.

    `appendMapping(mapping: Mapping)`
    :   Add all the step maps in a given mapping to this one (preserving
        mirroring information).

    `getMirror(n: number) → number | undefined`
    :   Finds the offset of the step map that mirrors the map at the
        given offset, in this mapping (as per the second argument to
        `appendMap`).

    `appendMappingInverted(mapping: Mapping)`
    :   Append the inverse of the given mapping to this one.

    `invert() → Mapping`
    :   Create an inverted version of this mapping.

    `map(pos: number, assoc⁠?: number = 1) → number`
    :   Map a position through this mapping.

    `mapResult(pos: number, assoc⁠?: number = 1) → MapResult`
    :   Map a position through this mapping, returning a mapping
        result.

### [Document transforms](#transform.Document_transforms)

Because you often need to collect a number of steps together to effect
a composite change, ProseMirror provides an abstraction to make this
easy. [State transactions](#state.Transaction) are a subclass of
transforms.

#### `class` [Transform](#transform.Transform)
:   Abstraction to build up and track an array of
    [steps](#transform.Step) representing a document transformation.

    Most transforming methods return the `Transform` object itself, so
    that they can be chained.

    `new Transform(doc: Node)`
    :   Create a transform that starts with the given document.

    `steps: Step[]`
    :   The steps in this transform.

    `docs: Node[]`
    :   The documents before each of the steps.

    `mapping: Mapping`
    :   A mapping with the maps for each of the steps in this transform.

    `doc: Node`
    :   The current document (the result of applying the steps in the
        transform).

    `before: Node`
    :   The starting document.

    `step(step: Step) → Transform`
    :   Apply a new step in this transform, saving the result. Throws an
        error when the step fails.

    `maybeStep(step: Step) → StepResult`
    :   Try to apply a step in this transformation, ignoring it if it
        fails. Returns the step result.

    `docChanged: boolean`
    :   True when the document has been changed (when there are any
        steps).

    `replace( from: number, to⁠?: number = from, slice⁠?: Slice = Slice.empty ) → Transform`
    :   Replace the part of the document between `from` and `to` with the
        given `slice`.

    `replaceWith( from: number, to: number, content: Fragment | Node | readonly Node[] ) → Transform`
    :   Replace the given range with the given content, which may be a
        fragment, node, or array of nodes.

    `delete(from: number, to: number) → Transform`
    :   Delete the content between the given positions.

    `insert( pos: number, content: Fragment | Node | readonly Node[] ) → Transform`
    :   Insert the given content at the given position.

    `replaceRange(from: number, to: number, slice: Slice) → Transform`
    :   Replace a range of the document with a given slice, using
        `from`, `to`, and the slice's
        [`openStart`](#model.Slice.openStart) property as hints, rather
        than fixed start and end points. This method may grow the
        replaced area or close open nodes in the slice in order to get a
        fit that is more in line with WYSIWYG expectations, by dropping
        fully covered parent nodes of the replaced region when they are
        marked [non-defining as
        context](#model.NodeSpec.definingAsContext), or including an
        open parent node from the slice that *is* marked as [defining
        its content](#model.NodeSpec.definingForContent).

        This is the method, for example, to handle paste. The similar
        [`replace`](#transform.Transform.replace) method is a more
        primitive tool which will *not* move the start and end of its given
        range, and is useful in situations where you need more precise
        control over what happens.

    `replaceRangeWith(from: number, to: number, node: Node) → Transform`
    :   Replace the given range with a node, but use `from` and `to` as
        hints, rather than precise positions. When from and to are the same
        and are at the start or end of a parent node in which the given
        node doesn't fit, this method may *move* them out towards a parent
        that does allow the given node to be placed. When the given range
        completely covers a parent node, this method may completely replace
        that parent node.

    `deleteRange(from: number, to: number) → Transform`
    :   Delete the given range, expanding it to cover fully covered
        parent nodes until a valid replace is found.

    `lift(range: NodeRange, target: number) → Transform`
    :   Split the content in the given range off from its parent, if there
        is sibling content before or after it, and move it up the tree to
        the depth specified by `target`. You'll probably want to use
        [`liftTarget`](#transform.liftTarget) to compute `target`, to make
        sure the lift is valid.

    `join(pos: number, depth⁠?: number = 1) → Transform`
    :   Join the blocks around the given position. If depth is 2, their
        last and first siblings are also joined, and so on.

    `wrap( range: NodeRange, wrappers: readonly {type: NodeType, attrs⁠?: Attrs}[] ) → Transform`
    :   Wrap the given [range](#model.NodeRange) in the given set of wrappers.
        The wrappers are assumed to be valid in this position, and should
        probably be computed with [`findWrapping`](#transform.findWrapping).

    `setBlockType( from: number, to⁠?: number = from, type: NodeType, attrs⁠?: Attrs | fn(oldNode: Node) → Attrs | null = null ) → Transform`
    :   Set the type of all textblocks (partly) between `from` and `to` to
        the given node type with the given attributes.

    `setNodeMarkup( pos: number, type⁠?: NodeType, attrs⁠?: Attrs | null = null, marks⁠?: readonly Mark[] ) → Transform`
    :   Change the type, attributes, and/or marks of the node at `pos`.
        When `type` isn't given, the existing node type is preserved,

    `setNodeAttribute(pos: number, attr: string, value: any) → Transform`
    :   Set a single attribute on a given node to a new value.
        The `pos` addresses the document content. Use `setDocAttribute`
        to set attributes on the document itself.

    `setDocAttribute(attr: string, value: any) → Transform`
    :   Set a single attribute on the document to a new value.

    `addNodeMark(pos: number, mark: Mark) → Transform`
    :   Add a mark to the node at position `pos`.

    `removeNodeMark(pos: number, mark: Mark | MarkType) → Transform`
    :   Remove a mark (or all marks of the given type) from the node at
        position `pos`.

    `split( pos: number, depth⁠?: number = 1, typesAfter⁠?: ({type: NodeType, attrs⁠?: Attrs} | null)[] ) → Transform`
    :   Split the node at the given position, and optionally, if `depth` is
        greater than one, any number of nodes above that. By default, the
        parts split off will inherit the node type of the original node.
        This can be changed by passing an array of types and attributes to
        use after the split (with the outermost nodes coming first).

    `addMark(from: number, to: number, mark: Mark) → Transform`
    :   Add the given mark to the inline content between `from` and `to`.

    `removeMark( from: number, to: number, mark⁠?: Mark | MarkType | null ) → Transform`
    :   Remove marks from inline nodes between `from` and `to`. When
        `mark` is a single mark, remove precisely that mark. When it is
        a mark type, remove all marks of that type. When it is null,
        remove all marks of any type.

    `clearIncompatible( pos: number, parentType: NodeType, match⁠?: ContentMatch ) → Transform`
    :   Removes all marks and nodes from the content of the node at
        `pos` that don't match the given new parent node type. Accepts
        an optional starting [content match](#model.ContentMatch) as
        third argument.

The following helper functions can be useful when creating
transformations or determining whether they are even possible.

`replaceStep( doc: Node, from: number, to⁠?: number = from, slice⁠?: Slice = Slice.empty ) → Step | null`
:   ‘Fit’ a slice into a given position in the document, producing a
    [step](#transform.Step) that inserts it. Will return null if
    there's no meaningful way to insert the slice here, or inserting it
    would be a no-op (an empty slice over an empty range).

`liftTarget(range: NodeRange) → number | null`
:   Try to find a target depth to which the content in the given range
    can be lifted. Will not go across
    [isolating](#model.NodeSpec.isolating) parent nodes.

`findWrapping( range: NodeRange, nodeType: NodeType, attrs⁠?: Attrs | null = null, innerRange⁠?: NodeRange = range ) → {type: NodeType, attrs: Attrs | null}[] | null`
:   Try to find a valid way to wrap the content in the given range in a
    node of the given type. May introduce extra nodes around and inside
    the wrapper node, if necessary. Returns null if no valid wrapping
    could be found. When `innerRange` is given, that range's content is
    used as the content to fit into the wrapping, instead of the
    content of `range`.

`canSplit( doc: Node, pos: number, depth⁠?: number = 1, typesAfter⁠?: ({type: NodeType, attrs⁠?: Attrs} | null)[] ) → boolean`
:   Check whether splitting at the given position is allowed.

`canJoin(doc: Node, pos: number) → boolean`
:   Test whether the blocks before and after a given position can be
    joined.

`joinPoint(doc: Node, pos: number, dir⁠?: number = -1) → number | undefined`
:   Find an ancestor of the given position that can be joined to the
    block before (or after if `dir` is positive). Returns the joinable
    point, if any.

`insertPoint(doc: Node, pos: number, nodeType: NodeType) → number | null`
:   Try to find a point where a node of the given type can be inserted
    near `pos`, by searching up the node hierarchy when `pos` itself
    isn't a valid place but is at the start or end of a node. Return
    null if no position was found.

`dropPoint(doc: Node, pos: number, slice: Slice) → number | null`
:   Finds a position at or around the given position where the given
    slice can be inserted. Will look at parent nodes' nearest boundary
    and try there, even if the original position wasn't directly at the
    start or end of that node. Returns null when no position was found.

[prosemirror-commands module](#commands)
----------------------------------------

This module exports a number of *commands*, which are building block
functions that encapsulate an editing action. A command function takes
an editor state, *optionally* a `dispatch` function that it can use
to dispatch a transaction and *optionally* an `EditorView` instance.
It should return a boolean that indicates whether it could perform any
action. When no `dispatch` callback is passed, the command should do a
'dry run', determining whether it is applicable, but not actually doing
anything.

These are mostly used to bind keys and define menu items.

`chainCommands(...commands: readonly Command[]) → Command`
:   Combine a number of command functions into a single function (which
    calls them one by one until one returns true).

`deleteSelection: Command`
:   Delete the selection, if there is one.

`joinBackward: Command`
:   If the selection is empty and at the start of a textblock, try to
    reduce the distance between that block and the one before it—if
    there's a block directly before it that can be joined, join them.
    If not, try to move the selected block closer to the next one in
    the document structure by lifting it out of its parent or moving it
    into a parent of the previous block. Will use the view for accurate
    (bidi-aware) start-of-textblock detection if given.

`selectNodeBackward: Command`
:   When the selection is empty and at the start of a textblock, select
    the node before that textblock, if possible. This is intended to be
    bound to keys like backspace, after
    [`joinBackward`](#commands.joinBackward) or other deleting
    commands, as a fall-back behavior when the schema doesn't allow
    deletion at the selected point.

`joinTextblockBackward: Command`
:   A more limited form of [`joinBackward`](#commands.joinBackward)
    that only tries to join the current textblock to the one before
    it, if the cursor is at the start of a textblock.

`joinForward: Command`
:   If the selection is empty and the cursor is at the end of a
    textblock, try to reduce or remove the boundary between that block
    and the one after it, either by joining them or by moving the other
    block closer to this one in the tree structure. Will use the view
    for accurate start-of-textblock detection if given.

`selectNodeForward: Command`
:   When the selection is empty and at the end of a textblock, select
    the node coming after that textblock, if possible. This is intended
    to be bound to keys like delete, after
    [`joinForward`](#commands.joinForward) and similar deleting
    commands, to provide a fall-back behavior when the schema doesn't
    allow deletion at the selected point.

`joinTextblockForward: Command`
:   A more limited form of [`joinForward`](#commands.joinForward)
    that only tries to join the current textblock to the one after
    it, if the cursor is at the end of a textblock.

`joinUp: Command`
:   Join the selected block or, if there is a text selection, the
    closest ancestor block of the selection that can be joined, with
    the sibling above it.

`joinDown: Command`
:   Join the selected block, or the closest ancestor of the selection
    that can be joined, with the sibling after it.

`lift: Command`
:   Lift the selected block, or the closest ancestor block of the
    selection that can be lifted, out of its parent node.

`newlineInCode: Command`
:   If the selection is in a node whose type has a truthy
    [`code`](#model.NodeSpec.code) property in its spec, replace the
    selection with a newline character.

`exitCode: Command`
:   When the selection is in a node with a truthy
    [`code`](#model.NodeSpec.code) property in its spec, create a
    default block after the code block, and move the cursor there.

`createParagraphNear: Command`
:   If a block node is selected, create an empty paragraph before (if
    it is its parent's first child) or after it.

`liftEmptyBlock: Command`
:   If the cursor is in an empty textblock that can be lifted, lift the
    block.

`splitBlock: Command`
:   Split the parent block of the selection. If the selection is a text
    selection, also delete its content.

`splitBlockAs( splitNode⁠?: fn( node: Node, atEnd: boolean, $from: ResolvedPos ) → {type: NodeType, attrs⁠?: Attrs} | null ) → Command`
:   Create a variant of [`splitBlock`](#commands.splitBlock) that uses
    a custom function to determine the type of the newly split off block.

`splitBlockKeepMarks: Command`
:   Acts like [`splitBlock`](#commands.splitBlock), but without
    resetting the set of active marks at the cursor.

`selectParentNode: Command`
:   Move the selection to the node wrapping the current selection, if
    any. (Will not select the document node.)

`selectAll: Command`
:   Select the whole document.

`selectTextblockStart: Command`
:   Moves the cursor to the start of current text block.

`selectTextblockEnd: Command`
:   Moves the cursor to the end of current text block.

`wrapIn( nodeType: NodeType, attrs⁠?: Attrs | null = null ) → Command`
:   Wrap the selection in a node of the given type with the given
    attributes.

`setBlockType( nodeType: NodeType, attrs⁠?: Attrs | null = null ) → Command`
:   Returns a command that tries to set the selected textblocks to the
    given node type with the given attributes.

`toggleMark( markType: MarkType, attrs⁠?: Attrs | null = null, options⁠?: Object ) → Command`
:   Create a command function that toggles the given mark with the
    given attributes. Will return `false` when the current selection
    doesn't support that mark. This will remove the mark if any marks
    of that type exist in the selection, or add it otherwise. If the
    selection is empty, this applies to the [stored
    marks](#state.EditorState.storedMarks) instead of a range of the
    document.

    `options`
    :   `removeWhenPresent⁠?: boolean`
        :   Controls whether, when part of the selected range has the mark
            already and part doesn't, the mark is removed (`true`, the
            default) or added (`false`).

        `enterInlineAtoms⁠?: boolean`
        :   When set to false, this will prevent the command from acting on
            the content of inline nodes marked as
            [atoms](#model.NodeSpec.atom) that are completely covered by a
            selection range.

        `includeWhitespace⁠?: boolean`
        :   By default, this command doesn't apply to leading and trailing
            whitespace in the selection. Set this to `true` to change that.

`autoJoin( command: Command, isJoinable: fn(before: Node, after: Node) → boolean | readonly string[] ) → Command`
:   Wrap a command so that, when it produces a transform that causes
    two joinable nodes to end up next to each other, those are joined.
    Nodes are considered joinable when they are of the same type and
    when the `isJoinable` predicate returns true for them or, if an
    array of strings was passed, if their node type name is in that
    array.

`baseKeymap: Object<Command>`
:   Depending on the detected platform, this will hold
    [`pcBasekeymap`](#commands.pcBaseKeymap) or
    [`macBaseKeymap`](#commands.macBaseKeymap).

`pcBaseKeymap: Object<Command>`
:   A basic keymap containing bindings not specific to any schema.
    Binds the following keys (when multiple commands are listed, they
    are chained with [`chainCommands`](#commands.chainCommands)):

    * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
    * **Mod-Enter** to `exitCode`
    * **Backspace** and **Mod-Backspace** to `deleteSelection`, `joinBackward`, `selectNodeBackward`
    * **Delete** and **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
    * **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
    * **Mod-a** to `selectAll`

`macBaseKeymap: Object<Command>`
:   A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
    **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
    **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
    Ctrl-Delete.

[prosemirror-history module](#history)
--------------------------------------

An implementation of an undo/redo history for ProseMirror. This
history is *selective*, meaning it does not just roll back to a
previous state but can undo some changes while keeping other, later
changes intact. (This is necessary for collaborative editing, and
comes up in other situations as well.)

`history(config⁠?: Object = {}) → Plugin`
:   Returns a plugin that enables the undo history for an editor. The
    plugin will track undo and redo stacks, which can be used with the
    [`undo`](#history.undo) and [`redo`](#history.redo) commands.

    You can set an `"addToHistory"` [metadata
    property](#state.Transaction.setMeta) of `false` on a transaction
    to prevent it from being rolled back by undo.

    `config`
    :   `depth⁠?: number`
        :   The amount of history events that are collected before the
            oldest events are discarded. Defaults to 100.

        `newGroupDelay⁠?: number`
        :   The delay between changes after which a new group should be
            started. Defaults to 500 (milliseconds). Note that when changes
            aren't adjacent, a new group is always started.

`undo: Command`
:   A command function that undoes the last change, if any.

`redo: Command`
:   A command function that redoes the last undone change, if any.

`undoNoScroll: Command`
:   A command function that undoes the last change. Don't scroll the
    selection into view.

`redoNoScroll: Command`
:   A command function that redoes the last undone change. Don't
    scroll the selection into view.

`undoDepth(state: EditorState) → any`
:   The amount of undoable events available in a given state.

`redoDepth(state: EditorState) → any`
:   The amount of redoable events available in a given editor state.

`closeHistory(tr: Transaction) → Transaction`
:   Set a flag on the given transaction that will prevent further steps
    from being appended to an existing history event (so that they
    require a separate undo command to undo).

`isHistoryTransaction(tr: Transaction) → boolean`
:   Returns true if the given transaction was generated by the history
    plugin.

[prosemirror-collab module](#collab)
------------------------------------

This module implements an API into which a communication channel for
collaborative editing can be hooked. See
[the guide](/docs/guide/#collab) for more details and an example.

`collab(config⁠?: Object = {}) → Plugin`
:   Creates a plugin that enables the collaborative editing framework
    for the editor.

    `config`
    :   `version⁠?: number`
        :   The starting version number of the collaborative editing.
            Defaults to 0.

        `clientID⁠?: number | string`
        :   This client's ID, used to distinguish its changes from those of
            other clients. Defaults to a random 32-bit number.

`getVersion(state: EditorState) → number`
:   Get the version up to which the collab plugin has synced with the
    central authority.

`receiveTransaction( state: EditorState, steps: readonly Step[], clientIDs: readonly (string | number)[], options⁠?: Object = {} ) → Transaction`
:   Create a transaction that represents a set of new steps received from
    the authority. Applying this transaction moves the state forward to
    adjust to the authority's view of the document.

    `options`
    :   `mapSelectionBackward⁠?: boolean`
        :   When enabled (the default is `false`), if the current
            selection is a [text selection](#state.TextSelection), its
            sides are mapped with a negative bias for this transaction, so
            that content inserted at the cursor ends up after the cursor.
            Users usually prefer this, but it isn't done by default for
            reasons of backwards compatibility.

`sendableSteps(state: EditorState) → { version: number, steps: readonly Step[], clientID: number | string, origins: readonly Transaction[] } | null`
:   Provides data describing the editor's unconfirmed steps, which need
    to be sent to the central authority. Returns null when there is
    nothing to send.

    `origins` holds the *original* transactions that produced each
    steps. This can be useful for looking up time stamps and other
    metadata for the steps, but note that the steps may have been
    rebased, whereas the origin transactions are still the old,
    unchanged objects.

[prosemirror-keymap module](#keymap)
------------------------------------

A plugin for conveniently defining key bindings.

`keymap(bindings: Object<Command>) → Plugin`
:   Create a keymap plugin for the given set of bindings.

    Bindings should map key names to [command](#commands)-style
    functions, which will be called with `(EditorState, dispatch, EditorView)` arguments, and should return true when they've handled
    the key. Note that the view argument isn't part of the command
    protocol, but can be used as an escape hatch if a binding needs to
    directly interact with the UI.

    Key names may be strings like `"Shift-Ctrl-Enter"`—a key
    identifier prefixed with zero or more modifiers. Key identifiers
    are based on the strings that can appear in
    [`KeyEvent.key`](https:///developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).
    Use lowercase letters to refer to letter keys (or uppercase letters
    if you want shift to be held). You may use `"Space"` as an alias
    for the `" "` name.

    Modifiers can be given in any order. `Shift-` (or `s-`), `Alt-` (or
    `a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or
    `Meta-`) are recognized. For characters that are created by holding
    shift, the `Shift-` prefix is implied, and should not be added
    explicitly.

    You can use `Mod-` as a shorthand for `Cmd-` on Mac and `Ctrl-` on
    other platforms.

    You can add multiple keymap plugins to an editor. The order in
    which they appear determines their precedence (the ones early in
    the array get to dispatch first).

`keydownHandler(bindings: Object<Command>) → fn(view: EditorView, event: KeyboardEvent) → boolean`
:   Given a set of bindings (using the same format as
    [`keymap`](#keymap.keymap)), return a [keydown
    handler](#view.EditorProps.handleKeyDown) that handles them.

[prosemirror-inputrules module](#inputrules)
--------------------------------------------

This module defines a plugin for attaching *input rules* to an editor,
which can react to or transform text typed by the user. It also comes
with a bunch of default rules that can be enabled in this plugin.

#### `class` [InputRule](#inputrules.InputRule)
:   Input rules are regular expressions describing a piece of text
    that, when typed, causes something to happen. This might be
    changing two dashes into an emdash, wrapping a paragraph starting
    with `"> "` into a blockquote, or something entirely different.

    `new InputRule( match: RegExp, handler: string | fn( state: EditorState, match: RegExpMatchArray, start: number, end: number ) → Transaction | null , options⁠?: Object = {} )`
    :   Create an input rule. The rule applies when the user typed
        something and the text directly in front of the cursor matches
        `match`, which should end with `$`.

        The `handler` can be a string, in which case the matched text, or
        the first matched group in the regexp, is replaced by that
        string.

        Or a it can be a function, which will be called with the match
        array produced by
        [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
        as well as the start and end of the matched range, and which can
        return a [transaction](#state.Transaction) that describes the
        rule's effect, or null to indicate the input was not handled.

        `options`
        :   `undoable⁠?: boolean`
            :   When set to false,
                [`undoInputRule`](#inputrules.undoInputRule) doesn't work on
                this rule.

            `inCode⁠?: boolean | "only"`
            :   By default, input rules will not apply inside nodes marked
                as [code](#model.NodeSpec.code). Set this to true to change
                that, or to `"only"` to *only* match in such nodes.

            `inCodeMark⁠?: boolean`
            :   When set to `false`, this rule will not fire inside marks
                marked as [code](#model.MarkSpec.code). The default is
                `true`.

    `inCode: boolean | "only"`


    `inCodeMark: boolean | "only"`

`inputRules({rules: readonly InputRule[]}) → Plugin< {transform: Transaction, from: number, to: number, text: string} | null >`
:   Create an input rules plugin. When enabled, it will cause text
    input that matches any of the given rules to trigger the rule's
    action.

`undoInputRule: Command`
:   This is a command that will undo an input rule, if applying such a
    rule was the last thing that the user did.

The module comes with a number of predefined rules:

`emDash: InputRule`
:   Converts double dashes to an emdash.

`ellipsis: InputRule`
:   Converts three dots to an ellipsis character.

`openDoubleQuote: InputRule`
:   “Smart” opening double quotes.

`closeDoubleQuote: InputRule`
:   “Smart” closing double quotes.

`openSingleQuote: InputRule`
:   “Smart” opening single quotes.

`closeSingleQuote: InputRule`
:   “Smart” closing single quotes.

`smartQuotes: readonly InputRule[]`
:   Smart-quote related input rules.

These utility functions take schema-specific parameters and create
input rules specific to that schema.

`wrappingInputRule( regexp: RegExp, nodeType: NodeType, getAttrs⁠?: Attrs | fn(matches: RegExpMatchArray) → Attrs | null | null = null, joinPredicate⁠?: fn(match: RegExpMatchArray, node: Node) → boolean ) → InputRule`
:   Build an input rule for automatically wrapping a textblock when a
    given string is typed. The `regexp` argument is
    directly passed through to the `InputRule` constructor. You'll
    probably want the regexp to start with `^`, so that the pattern can
    only occur at the start of a textblock.

    `nodeType` is the type of node to wrap in. If it needs attributes,
    you can either pass them directly, or pass a function that will
    compute them from the regular expression match.

    By default, if there's a node with the same type above the newly
    wrapped node, the rule will try to [join](#transform.Transform.join) those
    two nodes. You can pass a join predicate, which takes a regular
    expression match and the node before the wrapped node, and can
    return a boolean to indicate whether a join should happen.

`textblockTypeInputRule( regexp: RegExp, nodeType: NodeType, getAttrs⁠?: Attrs | fn(match: RegExpMatchArray) → Attrs | null | null = null ) → InputRule`
:   Build an input rule that changes the type of a textblock when the
    matched text is typed into it. You'll usually want to start your
    regexp with `^` to that it is only matched at the start of a
    textblock. The optional `getAttrs` parameter can be used to compute
    the new node's attributes, and works the same as in the
    `wrappingInputRule` function.

[prosemirror-gapcursor module](#gapcursor)
------------------------------------------

This is a plugin that adds a type of selection for focusing places
that don't allow regular selection (such as positions that have a leaf
block node, table, or the end of the document both before and after
them). By default, leaf blocks and isolating nodes will allow gap
cursors to appear next to them. You can add a `creatGapCursor: true`
property to a block node's spec to make them appear next to other
nodes as well.

You'll probably want to load `style/gapcursor.css`, which contains
basic styling for the simulated cursor (as a short, blinking
horizontal stripe).

By default, gap cursor are only allowed in places where the default
content node (in the schema content constraints) is a textblock node.
You can customize this by adding an `allowGapCursor` property to your
node specs—if it's true, gap cursor are allowed everywhere in that
node, if it's `false` they are never allowed.

`gapCursor() → Plugin`
:   Create a gap cursor plugin. When enabled, this will capture clicks
    near and arrow-key-motion past places that don't have a normally
    selectable position nearby, and create a gap cursor selection for
    them. The cursor is drawn as an element with class
    `ProseMirror-gapcursor`. You can either include
    `style/gapcursor.css` from the package's directory or add your own
    styles to make it visible.

#### `class` [GapCursor](#gapcursor.GapCursor) `extends Selection`
:   Gap cursor selections are represented using this class. Its
    `$anchor` and `$head` properties both point at the cursor position.

    `new GapCursor($pos: ResolvedPos)`
    :   Create a gap cursor.

[prosemirror-schema-basic module](#schema-basic)
------------------------------------------------

This module defines a simple schema. You can use it directly, extend
it, or just pick out a few node and mark specs to use in a new schema.

`schema: Schema< "blockquote" | "doc" | "paragraph" | "horizontal_rule" | "heading" | "code_block" | "text" | "image" | "hard_break" , "code" | "em" | "strong" | "link" >`
:   This schema roughly corresponds to the document schema used by
    [CommonMark](http://commonmark.org/), minus the list elements,
    which are defined in the [`prosemirror-schema-list`](#schema-list)
    module.

    To reuse elements from this schema, extend or read from its
    `spec.nodes` and `spec.marks` [properties](#model.Schema.spec).

`nodes: Object`
:   [Specs](#model.NodeSpec) for the nodes defined in this schema.

    `doc: NodeSpec`
    :   NodeSpec The top level document node.

    `paragraph: NodeSpec`
    :   A plain paragraph textblock. Represented in the DOM
        as a `<p>` element.

    `blockquote: NodeSpec`
    :   A blockquote (`<blockquote>`) wrapping one or more blocks.

    `horizontal_rule: NodeSpec`
    :   A horizontal rule (`<hr>`).

    `heading: NodeSpec`
    :   A heading textblock, with a `level` attribute that
        should hold the number 1 to 6. Parsed and serialized as `<h1>` to
        `<h6>` elements.

    `code_block: NodeSpec`
    :   A code listing. Disallows marks or non-text inline
        nodes by default. Represented as a `<pre>` element with a
        `<code>` element inside of it.

    `text: NodeSpec`
    :   The text node.

    `image: NodeSpec`
    :   An inline image (`<img>`) node. Supports `src`,
        `alt`, and `href` attributes. The latter two default to the empty
        string.

    `hard_break: NodeSpec`
    :   A hard line break, represented in the DOM as `<br>`.

`marks: Object`
:   [Specs](#model.MarkSpec) for the marks in the schema.

    `link: MarkSpec`
    :   A link. Has `href` and `title` attributes. `title`
        defaults to the empty string. Rendered and parsed as an `<a>`
        element.

    `em: MarkSpec`
    :   An emphasis mark. Rendered as an `<em>` element. Has parse rules
        that also match `<i>` and `font-style: italic`.

    `strong: MarkSpec`
    :   A strong mark. Rendered as `<strong>`, parse rules also match
        `<b>` and `font-weight: bold`.

    `code: MarkSpec`
    :   Code font mark. Represented as a `<code>` element.

[prosemirror-schema-list module](#schema-list)
----------------------------------------------

This module exports list-related schema elements and commands. The
commands assume lists to be nestable, with the restriction that the
first child of a list item is a plain paragraph.

These are the node specs:

`orderedList: NodeSpec`
:   An ordered list [node spec](#model.NodeSpec). Has a single
    attribute, `order`, which determines the number at which the list
    starts counting, and defaults to 1. Represented as an `<ol>`
    element.

`bulletList: NodeSpec`
:   A bullet list node spec, represented in the DOM as `<ul>`.

`listItem: NodeSpec`
:   A list item (`<li>`) spec.

`addListNodes( nodes: OrderedMap<NodeSpec>, itemContent: string, listGroup⁠?: string ) → OrderedMap<NodeSpec>`
:   Convenience function for adding list-related node types to a map
    specifying the nodes for a schema. Adds
    [`orderedList`](#schema-list.orderedList) as `"ordered_list"`,
    [`bulletList`](#schema-list.bulletList) as `"bullet_list"`, and
    [`listItem`](#schema-list.listItem) as `"list_item"`.

    `itemContent` determines the content expression for the list items.
    If you want the commands defined in this module to apply to your
    list structure, it should have a shape like `"paragraph block*"` or
    `"paragraph (ordered_list | bullet_list)*"`. `listGroup` can be
    given to assign a group name to the list node types, for example
    `"block"`.

Using this would look something like this:

```
const mySchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseSchema.spec.marks
})
```

The following functions are [commands](/docs/guide/#commands) and utilities:

`wrapInList( listType: NodeType, attrs⁠?: Attrs | null = null ) → Command`
:   Returns a command function that wraps the selection in a list with
    the given type an attributes. If `dispatch` is null, only return a
    value to indicate whether this is possible, but don't actually
    perform the change.

`wrapRangeInList( tr: Transaction | null, range: NodeRange, listType: NodeType, attrs⁠?: Attrs | null = null ) → boolean`
:   Try to wrap the given node range in a list of the given type.
    Return `true` when this is possible, `false` otherwise. When `tr`
    is non-null, the wrapping is added to that transaction. When it is
    `null`, the function only queries whether the wrapping is
    possible.

`splitListItem(itemType: NodeType, itemAttrs⁠?: Attrs) → Command`
:   Build a command that splits a non-empty textblock at the top level
    of a list item by also splitting that list item.

`splitListItemKeepMarks(itemType: NodeType, itemAttrs⁠?: Attrs) → Command`
:   Acts like [`splitListItem`](#schema-list.splitListItem), but
    without resetting the set of active marks at the cursor.

`liftListItem(itemType: NodeType) → Command`
:   Create a command to lift the list item around the selection up into
    a wrapping list.

`sinkListItem(itemType: NodeType) → Command`
:   Create a command to sink the list item around the selection down
    into an inner list.

[Backers](/backers.html)
[Code of Conduct](http://contributor-covenant.org/version/1/1/0/)
[Discuss](https://discuss.prosemirror.net/)
[Report an Issue](https://github.com/prosemirror/prosemirror/issues)


----------------------------------------------------------------------------------


# Track Changes example

ProseMirror change tracking example



[ProseMirror](/)

[Examples](/examples/)
[Documentation](/docs/)
[Discuss](https://discuss.prosemirror.net/)
[GitHub](https://github.com/prosemirror)

Tracking changes
================

Changes are first-class values in ProseMirror. You can hold on to
them, and do things with them. Such as
[rebasing](/docs/guide/#transform.rebasing) them across other changes,
inverting them, or inspecting them to see what they did.

This example uses those properties to allow you to “commit” your
changes, to revert individual commits, and to find out which commit a
piece of text originates from.

Commit message:  commit

blame at cursor

Hover over commits to highlight the text they introduced.

This page won't list the [whole source
code](https://github.com/ProseMirror/website/blob/master/example/track/index.js)
for the example, only the most interesting parts.

The first thing we need is a way to track the commit history. An
editor plugin works well for this, since it can observe changes as
they come in. This is what the plugin's state value looks like:

```
class TrackState {
  constructor(blameMap, commits, uncommittedSteps, uncommittedMaps) {
    // The blame map is a data structure that lists a sequence of
    // document ranges, along with the commit that inserted them. This
    // can be used to, for example, highlight the part of the document
    // that was inserted by a commit.
    this.blameMap = blameMap
    // The commit history, as an array of objects.
    this.commits = commits
    // Inverted steps and their maps corresponding to the changes that
    // have been made since the last commit.
    this.uncommittedSteps = uncommittedSteps
    this.uncommittedMaps = uncommittedMaps
  }

  // Apply a transform to this state
  applyTransform(transform) {
    // Invert the steps in the transaction, to be able to save them in
    // the next commit
    let inverted =
      transform.steps.map((step, i) => step.invert(transform.docs[i]))
    let newBlame = updateBlameMap(this.blameMap, transform, this.commits.length)
    // Create a new state—since these are part of the editor state, a
    // persistent data structure, they must not be mutated.
    return new TrackState(newBlame, this.commits,
                          this.uncommittedSteps.concat(inverted),
                          this.uncommittedMaps.concat(transform.mapping.maps))
  }

  // When a transaction is marked as a commit, this is used to put any
  // uncommitted steps into a new commit.
  applyCommit(message, time) {
    if (this.uncommittedSteps.length == 0) return this
    let commit = new Commit(message, time, this.uncommittedSteps,
                            this.uncommittedMaps)
    return new TrackState(this.blameMap, this.commits.concat(commit), [], [])
  }
}
```

The plugin itself does little more than watch transactions and update
its state. When a meta property tagged by the plugin is present on the
transaction, it is a commit transaction, and the property's value is
the commit message.

```
import {Plugin} from "prosemirror-state"

const trackPlugin = new Plugin({
  state: {
    init(_, instance) {
      return new TrackState([new Span(0, instance.doc.content.size, null)], [], [], [])
    },
    apply(tr, tracked) {
      if (tr.docChanged) tracked = tracked.applyTransform(tr)
      let commitMessage = tr.getMeta(this)
      if (commitMessage) tracked = tracked.applyCommit(commitMessage, new Date(tr.time))
      return tracked
    }
  }
})
```

Tracking history like this allows for all kinds of useful things, such
as figuring out who added a given piece of code, and when. Or
reverting individual commits.

Reverting an old steps requires
[rebasing](/docs/guide/#transform.rebasing) the inverted form of those
steps over all intermediate steps. That is what this function does.

```
import {Mapping} from "prosemirror-transform"

function revertCommit(commit) {
  let trackState = trackPlugin.getState(state)
  let index = trackState.commits.indexOf(commit)
  // If this commit is not in the history, we can't revert it
  if (index == -1) return

  // Reverting is only possible if there are no uncommitted changes
  if (trackState.uncommittedSteps.length)
    return alert("Commit your changes first!")

  // This is the mapping from the document as it was at the start of
  // the commit to the current document.
  let remap = new Mapping(trackState.commits.slice(index)
                          .reduce((maps, c) => maps.concat(c.maps), []))
  let tr = state.tr
  // Build up a transaction that includes all (inverted) steps in this
  // commit, rebased to the current document. They have to be applied
  // in reverse order.
  for (let i = commit.steps.length - 1; i >= 0; i--) {
    // The mapping is sliced to not include maps for this step and the
    // ones before it.
    let remapped = commit.steps[i].map(remap.slice(i + 1))
    if (!remapped) continue
    let result = tr.maybeStep(remapped)
    // If the step can be applied, add its map to our mapping
    // pipeline, so that subsequent steps are mapped over it.
    if (result.doc) remap.appendMap(remapped.getMap(), i)
  }
  // Add a commit message and dispatch.
  if (tr.docChanged)
    dispatch(tr.setMeta(trackPlugin, `Revert '${commit.message}'`))
}
```

Due to the implicit conflict resolution when moving changes across
each other, outcomes of complicated reverts, where later changes touch
the same content, can sometimes be unintuitive. In a production
application, it may be desirable to detect such conflicts and provide
the user with an interface to resolve them.

[Backers](/backers.html)
[Code of Conduct](http://contributor-covenant.org/version/1/1/0/)
[Discuss](https://discuss.prosemirror.net/)
[Report an Issue](https://github.com/prosemirror/prosemirror/issues)


----------------------------------------------------------------------------------

