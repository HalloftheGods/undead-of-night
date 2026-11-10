<template>
  <div class="mag-flow mag-cover cm-cover" @click="$emit('click', $event)">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineEmits<{ click: [event: MouseEvent] }>();
</script>
