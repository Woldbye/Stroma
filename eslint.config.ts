import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility';
import pluginOxlint from 'eslint-plugin-oxlint';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  pluginVueA11y.configs['flat/recommended'],
  {
    name: 'app/a11y-overrides',
    rules: {
      // A control nested inside its label is associated; the rule's default demands an id too.
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
    },
  },
  {
    name: 'app/shadcn-primitives',
    files: ['src/components/ui/**/*.vue'],
    rules: {
      // shadcn names a primitive after the element it stands for: Drawer, Switch, Toggle.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    name: 'app/components-stay-off-the-model',
    files: ['src/components/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/iris', '@/iris/*', '**/iris/*'],
              message:
                'Components take plain data; the model is driven from src/composables/use-iris.ts.',
            },
          ],
        },
      ],
    },
  },
  vueTsConfigs.recommended,
  ...pluginOxlint.configs['flat/recommended'],
  skipFormatting
);
