<script setup lang="ts">
import type { ClassroomToolRecordType } from '@/types/ApiClassroomTools'
defineProps<{ tools: ClassroomToolRecordType[]; disabled: boolean }>()
const emit = defineEmits<{
  edit: [record: ClassroomToolRecordType]
  copy: [record: ClassroomToolRecordType]
  remove: [record: ClassroomToolRecordType]
}>()
</script>
<template>
  <el-table :data="tools" border>
    <el-table-column label="类型" width="110"
      ><template #default="{ row }">{{
        row.kind === 'seating' ? '座位表' : '值日表'
      }}</template></el-table-column
    >
    <el-table-column prop="content.name" label="方案名称" />
    <el-table-column label="操作" width="240"
      ><template #default="{ row }">
        <el-button text :disabled="disabled" @click="emit('edit', row)">编辑</el-button>
        <el-button text :disabled="disabled" @click="emit('copy', row)">复制</el-button>
        <el-button text type="danger" :disabled="disabled" @click="emit('remove', row)"
          >删除</el-button
        >
      </template></el-table-column
    >
  </el-table>
</template>
