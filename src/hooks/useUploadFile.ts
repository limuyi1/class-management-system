import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { storeToRefs } from 'pinia'
import { parseExcel } from '@/untils/xlsxUntil'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'

export const useUploadFile = () => {
  const router = useRouter()
  const store = useDataSourceStore()
  const settingStore = useSettingStore()
  const configuration = useConfigurationStore()
  const { data: config } = storeToRefs(configuration)
  const { tableHeaders } = storeToRefs(settingStore)

  const uploadFile = async (file: any) => {
    try {
      parseExcel(file).then(({ header, data }) => {
        if (!header.includes('姓名')) {
          ElMessage.error('表格中必须包含[姓名]列！')
          return
        }

        const filteredHeader = header.filter(
          (label: string) => label !== '序号' && label !== '姓名'
        )

        const headerArray = filteredHeader.map((label: string) => ({
          prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
          label
        }))

        const headerObj = headerArray.reduce((acc: any, cur: any) => {
          acc[cur.prop] = null
          return acc
        }, {})

        const result = data.map((e: any) => {
          const _headerObj = Object.assign({ xing4_ming2: null }, headerObj)
          _headerObj.xing4_ming2 = e['姓名'] || null
          headerArray.forEach((headerItem) => {
            _headerObj[headerItem.prop] = e[headerItem.label] || null
          })
          return _headerObj
        })

        tableHeaders.value = headerArray
        store.data = result
        config.value.inputScoreTab = headerArray[0]?.prop

        ElMessage.success('导入成功！')
        router.push('/main/home')
      })
    } catch (err) {
      ElMessage.error('导入失败！')
    }
  }

  return { uploadFile }
}
