import { Extension } from "@tiptap/react";

export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle", "listItem"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain, state, commands }) => {
          // Apply to textStyle mark
          const markCommand = chain().setMark("textStyle", { fontSize });

          // Also apply to listItem nodes if we're in a list
          const { $from } = state.selection;
          let listItemDepth = -1;

          for (let i = $from.depth; i > 0; i--) {
            if ($from.node(i).type.name === "listItem") {
              listItemDepth = i;
              break;
            }
          }

          if (listItemDepth > -1) {
            // We're in a list, update the listItem node
            return (
              commands.updateAttributes("listItem", { fontSize }) &&
              markCommand.run()
            );
          }

          return markCommand.run();
        },
      unsetFontSize:
        () =>
        ({ chain, commands }) => {
          return (
            chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run() &&
            commands.updateAttributes("listItem", { fontSize: null })
          );
        },
    };
  },
});
