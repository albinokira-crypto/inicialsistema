package com.example.vistoriainicial

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.util.Base64
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import android.app.Activity
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {
    internal lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_RESULT_CODE = 1
    internal var cameraPhotoUri: Uri? = null
    internal var activeCameraVehicleName: String = ""
    internal val CAMERA_CAPTURE_REQUEST_CODE = 400
    internal val importedPhotoNames = HashSet<String>()
    internal val importedMediaStoreIds = HashSet<Long>() // rastreia IDs do MediaStore já importados
    internal val originalPaths = HashMap<String, String>()

    private val mediaCapturedReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action == "com.example.vistoriainicial.MEDIA_CAPTURED") {
                val vehicleName = intent.getStringExtra("vehicle_name") ?: ""
                val filename = intent.getStringExtra("filename") ?: ""
                if (vehicleName.isNotEmpty() && filename.isNotEmpty()) {
                    runOnUiThread {
                        webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$vehicleName', '$filename', '')", null)
                    }
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        webView.clearCache(true)
        val container = android.widget.FrameLayout(this).apply {
            fitsSystemWindows = true
            addView(webView)
        }
        setContentView(container)

        val filter = android.content.IntentFilter("com.example.vistoriainicial.MEDIA_CAPTURED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaCapturedReceiver, filter, RECEIVER_EXPORTED)
        } else {
            registerReceiver(mediaCapturedReceiver, filter)
        }

        // Webview Settings
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.databaseEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Interface bridge to JS
        webView.addJavascriptInterface(AndroidInterface(this), "AndroidInterface")

        webView.webViewClient = WebViewClient()
        
        // Setup WebChromeClient to support File Chooser (<input type="file">)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val acceptTypes = fileChooserParams?.acceptTypes ?: emptyArray()
                val isImage = acceptTypes.isEmpty() || acceptTypes.any { it.contains("image") }
                val isVideo = acceptTypes.any { it.contains("video") }

                val takePictureIntent = if (isImage) {
                    Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).let { intent ->
                        try {
                            val photoFile = File(
                                getExternalFilesDir(Environment.DIRECTORY_PICTURES),
                                "IMG_${System.currentTimeMillis()}.jpg"
                            )
                            val photoURI = androidx.core.content.FileProvider.getUriForFile(
                                this@MainActivity,
                                "com.example.vistoriainicial.fileprovider",
                                photoFile
                            )
                            cameraPhotoUri = photoURI
                            intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, photoURI)
                            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                            intent
                        } catch (e: Exception) {
                            e.printStackTrace()
                            null
                        }
                    }
                } else null

                val takeVideoIntent = if (isVideo) {
                    Intent(android.provider.MediaStore.ACTION_VIDEO_CAPTURE).let { intent ->
                        try {
                            val videoFile = File(
                                getExternalFilesDir(Environment.DIRECTORY_MOVIES),
                                "VID_${System.currentTimeMillis()}.mp4"
                            )
                            val videoURI = androidx.core.content.FileProvider.getUriForFile(
                                this@MainActivity,
                                "com.example.vistoriainicial.fileprovider",
                                videoFile
                            )
                            cameraPhotoUri = videoURI
                            intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, videoURI)
                            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                            intent
                        } catch (e: Exception) {
                            e.printStackTrace()
                            null
                        }
                    }
                } else null

                val isCapture = fileChooserParams?.isCaptureEnabled == true
                if (isCapture && !isVideo && takePictureIntent != null) {
                    try {
                        val pm = packageManager
                        val captureIntent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
                        
                        // Check if preferred camera is saved
                        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                        val preferredPkg = prefs.getString("preferred_camera_package", null)
                        
                        if (preferredPkg != null) {
                            try {
                                pm.getPackageInfo(preferredPkg, 0)
                                val explicitIntent = Intent(captureIntent).apply {
                                    setPackage(preferredPkg)
                                    putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                                }
                                startActivityForResult(explicitIntent, FILE_CHOOSER_RESULT_CODE)
                                return true
                            } catch (e: Exception) {
                                prefs.edit().remove("preferred_camera_package").apply()
                            }
                        }

                        // Query direct cameras matching ACTION_IMAGE_CAPTURE
                        val resolvedActivities = pm.queryIntentActivities(captureIntent, 0)
                        val cameraActivities = ArrayList(resolvedActivities)

                        // Query all launcher activities to find cameras not exposed through standard query
                        val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                            addCategory(Intent.CATEGORY_LAUNCHER)
                        }
                        val launcherActivities = pm.queryIntentActivities(launcherIntent, 0)
                        
                        val addedPackages = HashSet<String>()
                        for (info in cameraActivities) {
                            addedPackages.add(info.activityInfo.packageName)
                        }
                        
                        // Keywords to identify potential third-party cameras
                        val cameraKeywords = listOf("camera", "câmera", "camer", "foto", "photo", "gcam", "opencamera", "camara")
                        for (info in launcherActivities) {
                            val pkgName = info.activityInfo.packageName.lowercase()
                            val label = info.loadLabel(pm).toString().lowercase()
                            
                            // Skip our own application package
                            if (pkgName == packageName.lowercase()) continue
                            
                            val isCameraApp = cameraKeywords.any { pkgName.contains(it) || label.contains(it) }
                            if (isCameraApp && !addedPackages.contains(info.activityInfo.packageName)) {
                                cameraActivities.add(info)
                                addedPackages.add(info.activityInfo.packageName)
                            }
                        }

                        if (cameraActivities.size > 1) {
                            val names = ArrayList<String>()
                            val intents = ArrayList<Intent>()
                            
                            for (resolveInfo in cameraActivities) {
                                val label = resolveInfo.loadLabel(pm).toString()
                                val packageName = resolveInfo.activityInfo.packageName
                                val intent = Intent(captureIntent).apply {
                                    setPackage(packageName)
                                    putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                                }
                                names.add(label)
                                intents.add(intent)
                            }
                            
                            runOnUiThread {
                                val builder = android.app.AlertDialog.Builder(this@MainActivity)
                                builder.setTitle("Selecione o aplicativo de Câmera")
                                builder.setItems(names.toTypedArray()) { dialog, which ->
                                    val selectedIntent = intents[which]
                                    val selectedPkg = selectedIntent.`package`
                                    if (selectedPkg != null) {
                                        prefs.edit().putString("preferred_camera_package", selectedPkg).apply()
                                    }
                                    startActivityForResult(selectedIntent, FILE_CHOOSER_RESULT_CODE)
                                    dialog.dismiss()
                                }
                                builder.setNegativeButton("Cancelar") { dialog, _ ->
                                    dialog.dismiss()
                                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                                    this@MainActivity.filePathCallback = null
                                }
                                builder.setOnCancelListener {
                                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                                    this@MainActivity.filePathCallback = null
                                }
                                builder.show()
                            }
                            return true
                        } else {
                            startActivityForResult(takePictureIntent, FILE_CHOOSER_RESULT_CODE)
                            return true
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        startActivityForResult(takePictureIntent, FILE_CHOOSER_RESULT_CODE)
                        return true
                    }
                }

                val contentSelectionIntent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }

                val intentsList = ArrayList<Intent>()
                if (takePictureIntent != null) intentsList.add(takePictureIntent)
                if (takeVideoIntent != null) intentsList.add(takeVideoIntent)
                val intentArray = intentsList.toTypedArray()

                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                    putExtra(Intent.EXTRA_TITLE, "Selecione a ação")
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
                }

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_RESULT_CODE)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    Toast.makeText(this@MainActivity, "Erro ao abrir seletor de arquivos", Toast.LENGTH_LONG).show()
                    return false
                }
                return true
            }
        }
        
        // Handle physical back button
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("if (typeof window.onAndroidBackButtonPressed === 'function') { window.onAndroidBackButtonPressed(); } else { 'fallback'; }") { result ->
                    if (result == null || result == "\"fallback\"" || result == "false" || result.contains("false")) {
                        runOnUiThread {
                            if (webView.canGoBack()) {
                                webView.goBack()
                            } else {
                                android.app.AlertDialog.Builder(this@MainActivity)
                                    .setTitle("Sair do Aplicativo")
                                    .setMessage("Deseja realmente sair do Gestão de Vistorias?")
                                    .setPositiveButton("Sim") { _, _ ->
                                        isEnabled = false
                                        onBackPressedDispatcher.onBackPressed()
                                    }
                                    .setNegativeButton("Não", null)
                                    .show()
                            }
                        }
                    }
                }
            }
        })

        // Load Live Vercel URL
        webView.loadUrl("https://gestao-vistoria-inicial.vercel.app/dashboard.html")

        // Request Permissions
        checkPermissions()
    }

    internal var checkPhotosStartTime: Long = 0
    internal var shouldCheckNewPhotos: Boolean = false

    override fun onResume() {
        super.onResume()
        val prefs = getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val shouldCheck = prefs.getBoolean("should_check_new_photos", false)
        if (shouldCheck) {
            // Check if the page is already loaded by evaluating a JS snippet
            webView.evaluateJavascript("typeof window.onPhotoCapturedFromAndroid") { result ->
                if (result != null && result.contains("function")) {
                    // Page is loaded and JS is ready! We can consume it now.
                    prefs.edit().putBoolean("should_check_new_photos", false).apply()
                    checkPhotosStartTime = prefs.getLong("check_photos_start_time", 0)
                    activeCameraVehicleName = prefs.getString("active_camera_vehicle_name", "") ?: ""
                    shouldCheckNewPhotos = false

                    Toast.makeText(this, "Importando novas fotos tiradas...", Toast.LENGTH_SHORT).show()
                    webView.postDelayed({
                        importedPhotoNames.clear()
                        scanDirectoriesForNewPhotos(checkPhotosStartTime)
                    }, 1000)
                }
            }
        }
    }

    private fun scanPhysicalCameraFolder(startTime: Long): Int {
        var importedCount = 0
        val dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
        val foldersToCheck = arrayOf(
            File(dcim, "Camera"),
            File(dcim, "OpenCamera")
        )
        
        for (folder in foldersToCheck) {
            if (folder.exists() && folder.isDirectory) {
                val files = folder.listFiles() ?: continue
                for (file in files) {
                    if (file.isFile && file.length() > 0) {
                        val name = file.name
                        if (importedPhotoNames.contains(name)) continue
                        
                        // Check if file was modified after camera session started (with 15s margin)
                        if (file.lastModified() >= (startTime - 15000)) {
                            try {
                                val saved = java.io.FileInputStream(file).use { inputStream ->
                                    savePhotoDirectly(activeCameraVehicleName, name, inputStream)
                                }
                                if (saved) {
                                    file.delete()
                                    android.media.MediaScannerConnection.scanFile(
                                        this@MainActivity,
                                        arrayOf(file.absolutePath),
                                        null,
                                        null
                                    )
                                    runOnUiThread {
                                        webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$activeCameraVehicleName', '$name', '')", null)
                                    }
                                    importedPhotoNames.add(name)
                                    importedCount++
                                    android.util.Log.d("Vistoria", "Imported and deleted physical file: ${file.absolutePath}")
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }
            }
        }
        return importedCount
    }

    fun scanDirectoriesForNewPhotos(startTime: Long) {
        importedPhotoNames.clear()
        importedMediaStoreIds.clear() // limpa IDs da sessão anterior
        
        Thread {
            for (attempt in 1..40) { // Check for 40 seconds
                val physCount = scanPhysicalCameraFolder(startTime)
                val imagesCount = queryMediaStoreForNewMedia(startTime, isVideo = false)
                val videosCount = queryMediaStoreForNewMedia(startTime, isVideo = true)
                val totalImported = physCount + imagesCount + videosCount
                if (totalImported > 0) {
                    runOnUiThread {
                        Toast.makeText(this, "✅ $totalImported arquivo(s) importado(s)!", Toast.LENGTH_SHORT).show()
                    }
                }
                
                try {
                    Thread.sleep(1000)
                } catch (e: InterruptedException) {
                    break
                }
            }
        }.start()
    }

    private fun queryMediaStoreForNewMedia(startTime: Long, isVideo: Boolean): Int {
        val uri = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_ADDED,
            if (isVideo) MediaStore.Video.VideoColumns.DATE_TAKEN else MediaStore.Images.ImageColumns.DATE_TAKEN,
            MediaStore.MediaColumns.DATA
        )
        val sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} DESC"
        val selection = "${MediaStore.MediaColumns.DATE_ADDED} >= ?"
        val selectionArgs = arrayOf(((startTime / 1000) - 15).toString()) // margin of 15 seconds
        var importedCount = 0
        val limit = 500
        
        try {
            val cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
            cursor?.use { c ->
                val idColumn = c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                val nameColumn = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                val dateAddedColumn = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                val dateTakenColumn = c.getColumnIndexOrThrow(if (isVideo) MediaStore.Video.VideoColumns.DATE_TAKEN else MediaStore.Images.ImageColumns.DATE_TAKEN)
                val dataColumn = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)
                
                var count = 0
                while (c.moveToNext() && count < limit) {
                    count++
                    val id = c.getLong(idColumn)
                    val name = c.getString(nameColumn) ?: "midia_${System.currentTimeMillis()}.${if (isVideo) "mp4" else "jpg"}"
                    val absolutePath = c.getString(dataColumn)
                    
                    val dateAddedSec = c.getLong(dateAddedColumn)
                    val dateTakenMs = c.getLong(dateTakenColumn)
                    
                    val dateAddedMs = dateAddedSec * 1000
                    val timestampToUse = if (dateTakenMs > 0) dateTakenMs else dateAddedMs
                    
                    if (timestampToUse >= (startTime - 15000)) {
                        // Pula se já importamos este ID ou nome nesta sessão
                        if (importedMediaStoreIds.contains(id)) continue
                        if (importedPhotoNames.contains(name)) continue
                        
                        val contentUri = Uri.withAppendedPath(uri, id.toString())
                        try {
                            val saved = contentResolver.openInputStream(contentUri)?.use { inputStream ->
                                savePhotoDirectly(activeCameraVehicleName, name, inputStream)
                            } ?: false
                            
                            if (saved) {
                                // Marca como importado ANTES de deletar para evitar reprocessamento
                                importedMediaStoreIds.add(id)
                                importedPhotoNames.add(name)
                                
                                // Deleta o original apenas se tiver caminho físico válido
                                if (absolutePath != null) {
                                    try {
                                        val origFile = File(absolutePath)
                                        if (origFile.exists() && origFile.isFile) {
                                            origFile.delete()
                                            android.media.MediaScannerConnection.scanFile(this@MainActivity, arrayOf(absolutePath), null, null)
                                            android.util.Log.d("Vistoria", "Deleted original file at path: $absolutePath")
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                }
                                
                                // Remove do banco do MediaStore
                                try {
                                    contentResolver.delete(contentUri, null, null)
                                } catch (e: Exception) {
                                    // Ignore
                                }
                                
                                runOnUiThread {
                                    webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$activeCameraVehicleName', '$name', '')", null)
                                }
                                importedCount++
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return importedCount
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == CAMERA_CAPTURE_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                val vehicleName = activeCameraVehicleName
                val photoFile = File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), "IMG_temp.jpg")
                val videoFile = File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "VID_temp.mp4")
                
                Thread {
                    try {
                        if (photoFile.exists() && photoFile.length() > 0) {
                            val filename = "foto_${System.currentTimeMillis()}.jpg"
                            val saved = photoFile.inputStream().use { inputStream ->
                                savePhotoDirectly(vehicleName, filename, inputStream)
                            }
                            if (saved) {
                                runOnUiThread {
                                    webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$vehicleName', '$filename', '')", null)
                                }
                                photoFile.delete()
                            }
                        } else if (videoFile.exists() && videoFile.length() > 0) {
                            val filename = "midia_${System.currentTimeMillis()}.mp4"
                            val saved = videoFile.inputStream().use { inputStream ->
                                savePhotoDirectly(vehicleName, filename, inputStream)
                            }
                            if (saved) {
                                runOnUiThread {
                                    webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$vehicleName', '$filename', '')", null)
                                    Toast.makeText(this@MainActivity, "✅ Vídeo salvo na pasta!", Toast.LENGTH_SHORT).show()
                                }
                                videoFile.delete()
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }.start()
            }
            cameraPhotoUri = null
            return
        }
        if (requestCode == 200) {
            if (resultCode == Activity.RESULT_OK) {
                val treeUri = data?.data
                if (treeUri != null) {
                    try {
                        val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        contentResolver.takePersistableUriPermission(treeUri, takeFlags)

                        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                        prefs.edit().putString("selected_folder_uri", treeUri.toString()).apply()

                        val folderName = getDocumentTreeFolderName(treeUri)
                        runOnUiThread {
                            webView.evaluateJavascript("window.onStorageFolderSelected('$folderName')", null)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Toast.makeText(this, "Erro ao obter permissão de pasta: " + e.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            return
        }
        if (requestCode == 300) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val clipData = data.clipData
                val currentVehicleName = activeCameraVehicleName.ifEmpty {
                    val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                    prefs.getString("active_camera_vehicle_name", "") ?: ""
                }
                
                Thread {
                    var count = 0
                    if (clipData != null) {
                        for (i in 0 until clipData.itemCount) {
                            val uri = clipData.getItemAt(i).uri
                            val filename = "foto_${System.currentTimeMillis()}_$i.jpg"
                            try {
                                val saved = contentResolver.openInputStream(uri)?.use { inputStream ->
                                    savePhotoDirectly(currentVehicleName, filename, inputStream)
                                } ?: false
                                if (saved) {
                                    runOnUiThread {
                                        webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$currentVehicleName', '$filename', '')", null)
                                    }
                                    count++
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    } else {
                        val uri = data.data
                        if (uri != null) {
                            val filename = "foto_${System.currentTimeMillis()}.jpg"
                            try {
                                val saved = contentResolver.openInputStream(uri)?.use { inputStream ->
                                    savePhotoDirectly(currentVehicleName, filename, inputStream)
                                } ?: false
                                if (saved) {
                                    runOnUiThread {
                                        webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$currentVehicleName', '$filename', '')", null)
                                    }
                                    count++
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                    if (count > 0) {
                        runOnUiThread {
                            Toast.makeText(this, "✅ $count foto(s) importada(s) da galeria!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }.start()
            }
            return
        }
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback == null) return
            var results: Array<Uri>? = null
            if (resultCode == Activity.RESULT_OK) {
                // Coleta todos os URIs: cameraPhotoUri + qualquer URI retornado pelo data (foto ou vídeo)
                val uriList = ArrayList<Uri>()
                if (cameraPhotoUri != null) {
                    uriList.add(cameraPhotoUri!!)
                }
                val fromData = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                if (fromData != null) {
                    for (u in fromData) {
                        if (u != null && !uriList.contains(u)) uriList.add(u)
                    }
                }
                if (uriList.isNotEmpty()) {
                    results = uriList.toTypedArray()
                }

                if (results != null) {
                    val currentVehicleName = activeCameraVehicleName.ifEmpty {
                        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                        prefs.edit().putString("active_camera_vehicle_name", "").apply()
                        ""
                    }
                    if (currentVehicleName.isNotEmpty()) {
                        Thread {
                            var count = 0
                            for (i in results!!.indices) {
                                val uri = results!![i]
                                try {
                                    // Detecta MIME pelo contentResolver; se falhar, tenta pelo path da URI
                                    val mimeType = contentResolver.getType(uri) ?: ""
                                    val isVideoFile = mimeType.startsWith("video") ||
                                        uri.path?.lowercase()?.let { p ->
                                            p.endsWith(".mp4") || p.endsWith(".3gp") ||
                                            p.endsWith(".mkv") || p.endsWith(".mov")
                                        } == true
                                    val ext = if (isVideoFile) "mp4" else "jpg"
                                    val filename = "midia_${System.currentTimeMillis()}_$i.$ext"
                                    
                                    val saved = contentResolver.openInputStream(uri)?.use { inputStream ->
                                        savePhotoDirectly(currentVehicleName, filename, inputStream)
                                    } ?: false
                                    if (saved) {
                                        deleteOriginalPhoto(filename)
                                        count++
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                            if (count > 0) {
                                runOnUiThread {
                                    Toast.makeText(this@MainActivity, "✅ $count arquivo(s) salvos na pasta!", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }.start()
                    }
                }
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
            cameraPhotoUri = null
        }
    }

    private fun getDocumentTreeFolderName(uri: Uri): String {
        return try {
            val documentId = DocumentsContract.getTreeDocumentId(uri)
            val parts = documentId.split(":")
            if (parts.size > 1) {
                parts[1]
            } else {
                documentId
            }
        } catch (e: Exception) {
            uri.path ?: "Pasta Selecionada"
        }
    }

    fun launchCameraCapture(vehicleName: String) {
        activeCameraVehicleName = vehicleName
        val pm = packageManager
        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
        val preferredPkg = prefs.getString("preferred_camera_package", null)

        if (preferredPkg == null) {
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val launcherActivities = pm.queryIntentActivities(launcherIntent, 0)
            val cameraActivities = ArrayList<android.content.pm.ResolveInfo>()
            val cameraKeywords = listOf("camera", "câmera", "camer", "foto", "photo", "gcam", "opencamera", "camara")
            
            for (info in launcherActivities) {
                val pkgName = info.activityInfo.packageName.lowercase()
                val label = info.loadLabel(pm).toString().lowercase()
                if (pkgName == packageName.lowercase()) continue
                val isCameraApp = cameraKeywords.any { pkgName.contains(it) || label.contains(it) }
                if (isCameraApp) {
                    cameraActivities.add(info)
                }
            }

            if (cameraActivities.size > 1) {
                val names = ArrayList<String>()
                val packages = ArrayList<String>()
                for (resolveInfo in cameraActivities) {
                    names.add(resolveInfo.loadLabel(pm).toString())
                    packages.add(resolveInfo.activityInfo.packageName)
                }
                
                runOnUiThread {
                    android.app.AlertDialog.Builder(this)
                        .setTitle("Selecione o aplicativo de Câmera")
                        .setItems(names.toTypedArray()) { dialog, which ->
                            val selectedPkg = packages[which]
                            prefs.edit().putString("preferred_camera_package", selectedPkg).apply()
                            dialog.dismiss()
                            startCameraAndRecordTime(selectedPkg)
                        }
                        .setNegativeButton("Cancelar", null)
                        .show()
                }
                return
            } else if (cameraActivities.size == 1) {
                val selectedPkg = cameraActivities[0].activityInfo.packageName
                prefs.edit().putString("preferred_camera_package", selectedPkg).apply()
                startCameraAndRecordTime(selectedPkg)
                return
            }
        }

        startCameraAndRecordTime(preferredPkg)
    }

    private fun startCameraAndRecordTime(preferredPkg: String?) {
        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
        val startTime = System.currentTimeMillis()
        // Limpa rastreamentos da sessão anterior para não contaminar a nova sessão
        importedPhotoNames.clear()
        importedMediaStoreIds.clear()
        prefs.edit().apply {
            putLong("check_photos_start_time", startTime)
            putString("active_camera_vehicle_name", activeCameraVehicleName)
            putBoolean("should_check_new_photos", true)
            apply()
        }
        launchStandaloneCamera(preferredPkg, isVideo = false)
    }

    private fun launchStandaloneCamera(preferredPkg: String?, isVideo: Boolean) {
        val pm = packageManager
        try {
            var intent: Intent? = null
            
            if (preferredPkg != null) {
                intent = pm.getLaunchIntentForPackage(preferredPkg)
            }
            
            if (intent == null) {
                intent = if (isVideo) {
                    Intent(android.provider.MediaStore.INTENT_ACTION_VIDEO_CAMERA)
                } else {
                    Intent(android.provider.MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
                }
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val fallbackIntent = Intent(android.provider.MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(fallbackIntent)
            } catch (ex: Exception) {
                ex.printStackTrace()
                Toast.makeText(this, "Erro ao abrir câmera: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun checkPermissions() {
        val permissions = ArrayList<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 100)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        addCategory("android.intent.category.DEFAULT")
                        data = Uri.parse(String.format("package:%s", packageName))
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent().apply {
                            action = android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION
                        }
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        }
    }

    fun getPhysicalPathFromTreeUri(uri: Uri): String? {
        try {
            val docId = DocumentsContract.getTreeDocumentId(uri)
            val split = docId.split(":")
            val type = split[0]
            val relativePath = if (split.size > 1) split[1] else ""
            
            return if ("primary".equals(type, ignoreCase = true)) {
                Environment.getExternalStorageDirectory().toString() + "/" + relativePath
            } else {
                val sdCardPath = "/storage/$type"
                if (java.io.File(sdCardPath).exists()) {
                    "$sdCardPath/$relativePath"
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    fun sanitizeFilename(name: String): String {
        return name.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
    }

    fun getOrCreateDirectory(parent: DocumentFile, name: String): DocumentFile? {
        val existing = parent.findFile(name)
        if (existing != null && existing.isDirectory) {
            return existing
        }
        return try {
            parent.createDirectory(name)
        } catch (e: Exception) {
            null
        }
    }

    fun getFileInDirectory(dir: DocumentFile, name: String): DocumentFile? {
        val existing = dir.findFile(name)
        if (existing != null && existing.isFile) {
            return existing
        }
        return null
    }

    fun deleteOriginalPhoto(filename: String) {
        // Safe no-op to prevent accidental deletion of copied target files
    }

    fun savePhotoDirectly(vehicleName: String, filename: String, sourceStream: java.io.InputStream): Boolean {
        val cleanVehicleName = sanitizeFilename(vehicleName)
        val cleanFilename = sanitizeFilename(filename)
        val prefs = getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val savedUriStr = prefs.getString("selected_folder_uri", null)

        var savedSuccessfully = false
        val isVideo = filename.lowercase().endsWith(".mp4")
        val mimeType = if (isVideo) "video/mp4" else "image/jpeg"

        if (savedUriStr != null) {
            try {
                val rootUri = Uri.parse(savedUriStr)
                val rootFolder = DocumentFile.fromTreeUri(this, rootUri)
                if (rootFolder != null && rootFolder.exists()) {
                    val vehicleFolder = getOrCreateDirectory(rootFolder, cleanVehicleName)
                    if (vehicleFolder != null) {
                        val file = getFileInDirectory(vehicleFolder, cleanFilename)
                        if (file != null) {
                            try { file.delete() } catch(e: Exception){}
                        }
                        val newFile = vehicleFolder.createFile(mimeType, cleanFilename)
                        if (newFile != null) {
                            contentResolver.openOutputStream(newFile.uri)?.use { ops ->
                                sourceStream.copyTo(ops)
                            }
                            savedSuccessfully = true
                            android.util.Log.d("Vistoria", "Saved safely via SAF: ${newFile.uri}")
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        if (!savedSuccessfully) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val resolver = contentResolver
                    val contentValues = android.content.ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, cleanFilename)
                        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                        put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/Vistorias/$cleanVehicleName/")
                    }
                    val targetUri = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    val uri = resolver.insert(targetUri, contentValues)
                    if (uri != null) {
                        resolver.openOutputStream(uri)?.use { ops ->
                            sourceStream.copyTo(ops)
                        }
                        savedSuccessfully = true
                    }
                } else {
                    val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                    val vistoriasDir = File(picturesDir, "Vistorias/$cleanVehicleName")
                    if (vistoriasDir.exists() || vistoriasDir.mkdirs()) {
                        val file = File(vistoriasDir, cleanFilename)
                        java.io.FileOutputStream(file).use { ops ->
                            sourceStream.copyTo(ops)
                        }
                        savedSuccessfully = true
                    }
                }
            } catch (err: Exception) {
                err.printStackTrace()
            }
        }
        return savedSuccessfully
    }
}

class AndroidInterface(private val activity: ComponentActivity) {
    private val tempShareFiles = ArrayList<java.io.File>()

    @JavascriptInterface
    fun onPageLoaded() {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            val prefs = mainAct.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val shouldCheck = prefs.getBoolean("should_check_new_photos", false)
            if (shouldCheck) {
                prefs.edit().putBoolean("should_check_new_photos", false).apply()
                
                mainAct.checkPhotosStartTime = prefs.getLong("check_photos_start_time", 0)
                mainAct.activeCameraVehicleName = prefs.getString("active_camera_vehicle_name", "") ?: ""
                mainAct.shouldCheckNewPhotos = false

                Toast.makeText(mainAct, "Importando novas fotos tiradas...", Toast.LENGTH_SHORT).show()
                mainAct.webView.postDelayed({
                    mainAct.scanDirectoriesForNewPhotos(mainAct.checkPhotosStartTime)
                }, 1000)
            }
        }
    }

    @JavascriptInterface
    fun clearTempShare() {
        tempShareFiles.clear()
        try {
            val cacheDir = java.io.File(activity.cacheDir, "share_temp")
            if (cacheDir.exists()) {
                cacheDir.deleteRecursively()
            }
            cacheDir.mkdirs()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun addTempShareFile(filename: String, base64Data: String) {
        try {
            val cacheDir = java.io.File(activity.cacheDir, "share_temp")
            if (!cacheDir.exists()) cacheDir.mkdirs()
            
            val file = java.io.File(cacheDir, filename)
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            file.writeBytes(bytes)
            tempShareFiles.add(file)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun startShare(vehicleName: String) {
        startShare(vehicleName, "Seguem as fotos da vistoria do veículo: $vehicleName")
    }

    @JavascriptInterface
    fun startShare(vehicleName: String, reportText: String) {
        activity.runOnUiThread {
            val mainAct = activity as MainActivity
            val cleanVehicleName = mainAct.sanitizeFilename(vehicleName)
            val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val savedUriStr = prefs.getString("selected_folder_uri", null)

            tempShareFiles.clear()
            val cacheDir = java.io.File(activity.cacheDir, "share_temp")
            try {
                if (cacheDir.exists()) {
                    cacheDir.deleteRecursively()
                }
                cacheDir.mkdirs()
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val filesToCopy = ArrayList<java.io.File>()
            val safUrisToCopy = ArrayList<Uri>()

            if (savedUriStr != null) {
                try {
                    val rootUri = Uri.parse(savedUriStr)
                    val rootFolder = androidx.documentfile.provider.DocumentFile.fromTreeUri(activity, rootUri)
                    if (rootFolder != null && rootFolder.exists()) {
                        val vehicleFolder = mainAct.getOrCreateDirectory(rootFolder, cleanVehicleName)
                        if (vehicleFolder != null && vehicleFolder.exists()) {
                            val files = vehicleFolder.listFiles()
                            for (file in files) {
                                if (file.isFile) {
                                    val name = file.name?.lowercase() ?: ""
                                    if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                                        name.endsWith(".png") || name.endsWith(".mp4") ||
                                        name.endsWith(".mov") || name.endsWith(".3gp") ||
                                        name.endsWith(".mkv")) {
                                        safUrisToCopy.add(file.uri)
                                    }
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            try {
                val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                val vistoriasDir = java.io.File(picturesDir, "Vistorias/$cleanVehicleName")
                if (vistoriasDir.exists()) {
                    val files = vistoriasDir.listFiles()
                    if (files != null) {
                        for (file in files) {
                            if (file.isFile) {
                                val name = file.name.lowercase()
                                if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                                    name.endsWith(".png") || name.endsWith(".mp4") ||
                                    name.endsWith(".mov") || name.endsWith(".3gp") ||
                                    name.endsWith(".mkv")) {
                                    filesToCopy.add(file)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            try {
                val externalPicturesDir = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
                if (externalPicturesDir != null && externalPicturesDir.exists()) {
                    val vistoriasDir = java.io.File(externalPicturesDir, "Vistorias/$cleanVehicleName")
                    if (vistoriasDir.exists()) {
                        val files = vistoriasDir.listFiles()
                        if (files != null) {
                            for (file in files) {
                                if (file.isFile) {
                                    val name = file.name.lowercase()
                                    if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                                        name.endsWith(".png") || name.endsWith(".mp4") ||
                                        name.endsWith(".mov") || name.endsWith(".3gp") ||
                                        name.endsWith(".mkv")) {
                                        filesToCopy.add(file)
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            var fileIndex = 1
            for (uri in safUrisToCopy) {
                try {
                    val inputStream = activity.contentResolver.openInputStream(uri)
                    if (inputStream != null) {
                        val filename = "foto_${fileIndex}.jpg"
                        val destFile = java.io.File(cacheDir, filename)
                        destFile.writeBytes(inputStream.readBytes())
                        tempShareFiles.add(destFile)
                        fileIndex++
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            val processedNames = HashSet<String>()
            for (file in filesToCopy) {
                if (processedNames.contains(file.name)) continue
                processedNames.add(file.name)
                try {
                    val destFile = java.io.File(cacheDir, file.name)
                    file.copyTo(destFile, overwrite = true)
                    tempShareFiles.add(destFile)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            if (tempShareFiles.isEmpty()) {
                Toast.makeText(activity, "Nenhuma foto encontrada para compartilhar nesta vistoria.", Toast.LENGTH_LONG).show()
                return@runOnUiThread
            }

            try {
                val uris = ArrayList<Uri>()
                for (file in tempShareFiles) {
                    val uri = androidx.core.content.FileProvider.getUriForFile(
                        activity,
                        "com.example.vistoriainicial.fileprovider",
                        file
                    )
                    uris.add(uri)
                }
                
                val intent = Intent().apply {
                    action = Intent.ACTION_SEND_MULTIPLE
                    // Usa */* para suportar fotos e vídeos juntos
                    type = "*/*"
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                    putExtra(Intent.EXTRA_SUBJECT, "Fotos da Vistoria: $vehicleName")
                    putExtra(Intent.EXTRA_TEXT, reportText)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                
                try {
                    val waIntent = Intent(intent).apply { setPackage("com.whatsapp") }
                    for (uri in uris) {
                        activity.grantUriPermission("com.whatsapp", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(waIntent)
                } catch (e: Exception) {
                    try {
                        val wbIntent = Intent(intent).apply { setPackage("com.whatsapp.w4b") }
                        for (uri in uris) {
                            activity.grantUriPermission("com.whatsapp.w4b", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        activity.startActivity(wbIntent)
                    } catch (e2: Exception) {
                        val chooser = Intent.createChooser(intent, "Compartilhar Fotos da Vistoria")
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        activity.startActivity(chooser)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Erro ao compartilhar: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun shareText(title: String, text: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent().apply {
                    action = Intent.ACTION_SEND
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                activity.startActivity(Intent.createChooser(intent, title))
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Erro ao compartilhar relatório: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun importPhotosFromGallery(vehicleName: String) {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            mainAct.activeCameraVehicleName = vehicleName
            val prefs = mainAct.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            prefs.edit().putString("active_camera_vehicle_name", vehicleName).apply()
            
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            mainAct.startActivityForResult(Intent.createChooser(intent, "Selecione as fotos tiradas"), 300)
        }
    }

    @JavascriptInterface
    fun selectStorageFolder() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        activity.startActivityForResult(intent, 200)
    }

    @JavascriptInterface
    fun launchCameraCapture(vehicleName: String) {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            mainAct.launchCameraCapture(vehicleName)
        }
    }

    @JavascriptInterface
    fun clearPreferredCamera() {
        val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().remove("preferred_camera_package").apply()
        activity.runOnUiThread {
            Toast.makeText(activity, "Preferência de câmera limpa!", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getPreferredCameraLabel(): String {
        val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val pkg = prefs.getString("preferred_camera_package", null) ?: return "Nenhuma"
        return try {
            val pm = activity.packageManager
            val info = pm.getApplicationInfo(pkg, 0)
            pm.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            "Configurada"
        }
    }

    @JavascriptInterface
    fun savePhoto(vehicleName: String, filename: String, base64Data: String) {
        savePhoto(vehicleName, filename, base64Data, "Vistorias")
    }

    @JavascriptInterface
    fun savePhoto(vehicleName: String, filename: String, base64Data: String, folderName: String) {
        val mainAct = activity as MainActivity
        Thread {
            val data: ByteArray
            try {
                data = Base64.decode(base64Data, Base64.DEFAULT)
            } catch (e: Exception) {
                e.printStackTrace()
                val err = "Erro decodificação base64: ${e.message}"
                mainAct.runOnUiThread {
                    Toast.makeText(activity, err, Toast.LENGTH_LONG).show()
                    mainAct.webView.evaluateJavascript("window.onPhotoSaveFailed('$err')", null)
                }
                return@Thread
            }

            val saved = java.io.ByteArrayInputStream(data).use { inputStream ->
                mainAct.savePhotoDirectly(vehicleName, filename, inputStream)
            }

            if (!saved) {
                mainAct.runOnUiThread {
                    Toast.makeText(activity, "Erro ao salvar foto no celular.", Toast.LENGTH_LONG).show()
                    mainAct.webView.evaluateJavascript("window.onPhotoSaveFailed('Erro ao salvar no armazenamento')", null)
                }
            } else {
                mainAct.deleteOriginalPhoto(mainAct.sanitizeFilename(filename))
            }
        }.start()
    }

    @JavascriptInterface
    fun openInspectionFolder(vehicleName: String) {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            val cleanVehicleName = mainAct.sanitizeFilename(vehicleName)
            val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val savedUriStr = prefs.getString("selected_folder_uri", null)
            
            try {
                if (savedUriStr != null) {
                    val rootUri = Uri.parse(savedUriStr)
                    val rootFolder = DocumentFile.fromTreeUri(activity, rootUri)
                    if (rootFolder != null && rootFolder.exists()) {
                        val vehicleFolder = mainAct.getOrCreateDirectory(rootFolder, cleanVehicleName)
                        if (vehicleFolder != null && vehicleFolder.exists()) {
                            // Usa a URI do DocumentFile da subpasta diretamente (não reconstrói via tree)
                            // e passa EXTRA_INITIAL_URI para o gerenciador de arquivos navegar até ela
                            val vehicleFolderUri = vehicleFolder.uri
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(vehicleFolderUri, DocumentsContract.Document.MIME_TYPE_DIR)
                                putExtra("android.provider.extra.INITIAL_URI", vehicleFolderUri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            try {
                                activity.startActivity(intent)
                                return@runOnUiThread
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                            // Fallback: tenta com Intent explícito para o Files do Google (DocumentsUI)
                            try {
                                val intentDocUI = Intent(Intent.ACTION_VIEW).apply {
                                    setClassName("com.google.android.documentsui", "com.android.documentsui.files.FilesActivity")
                                    putExtra("android.provider.extra.INITIAL_URI", vehicleFolderUri)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                activity.startActivity(intentDocUI)
                                return@runOnUiThread
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                        
                        // Fallback 1: Open root folder selected by user
                        try {
                            val rootDocId = DocumentsContract.getTreeDocumentId(rootUri)
                            val rootDocUri = DocumentsContract.buildDocumentUriUsingTree(rootUri, rootDocId)
                            val intentRoot = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(rootDocUri, DocumentsContract.Document.MIME_TYPE_DIR)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            activity.startActivity(intentRoot)
                            return@runOnUiThread
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
                
                // Fallback 2: Open physical Pictures/Vistorias folder
                val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                val vistoriasDir = java.io.File(picturesDir, "Vistorias/$cleanVehicleName")
                if (!vistoriasDir.exists()) vistoriasDir.mkdirs()
                
                try {
                    val providerUri = androidx.core.content.FileProvider.getUriForFile(
                        activity,
                        "com.example.vistoriainicial.fileprovider",
                        vistoriasDir
                    )
                    val intentPhys = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(providerUri, DocumentsContract.Document.MIME_TYPE_DIR)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(intentPhys)
                } catch (e: Exception) {
                    // Fallback 3: Launch system Files app directly
                    val openFilesIntent = activity.packageManager.getLaunchIntentForPackage("com.google.android.documentsui")
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" }
                    activity.startActivity(openFilesIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Não foi possível abrir a pasta: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun sharePdf(filename: String, base64Data: String) {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val cacheDir = java.io.File(activity.cacheDir, "pdf_temp")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                
                val file = java.io.File(cacheDir, filename)
                file.writeBytes(bytes)
                
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    activity,
                    "com.example.vistoriainicial.fileprovider",
                    file
                )
                
                val intent = Intent().apply {
                    action = Intent.ACTION_SEND
                    type = "application/pdf"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, filename)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                activity.startActivity(Intent.createChooser(intent, "Compartilhar Relatório"))
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Erro ao compartilhar PDF: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
