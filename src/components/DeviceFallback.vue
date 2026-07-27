<script setup>
defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: 'Kira 应用截图' },
})
</script>

<template>
  <div class="device-fallback">
    <div class="device-fallback__card">
      <img :src="src" :alt="alt" class="device-fallback__screen" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.device-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 380px;
}
.device-fallback__card {
  position: relative;
  width: min(300px, 78%);
  aspect-ratio: 9 / 19;
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  border: none;
  box-shadow: 0 20px 50px rgb(0 0 0 / 0.4);
  background: #1a1630;
}
.device-fallback__screen {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  background: #1a1630;
}
</style>
