<template>
  <li>
    <button class="cm-contents-item-btn" type="button" @click="$emit('press')">
      <slot />
    </button>
  </li>
</template>

<script setup lang="ts">
defineEmits<{ press: [] }>();
</script>
