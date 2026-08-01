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
    internal var photoResultReceived = false
    internal var pendingBackupJson: String? = null

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
        
        // Setup WebChromeClient to support File Chooser (<input type="file">) and custom Alert dialogs
        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: android.webkit.JsResult?): Boolean {
                android.app.AlertDialog.Builder(this@MainActivity)
                    .setTitle("Gestão de Vistorias diz:")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                    .setCancelable(false)
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: android.webkit.JsResult?): Boolean {
                android.app.AlertDialog.Builder(this@MainActivity)
                    .setTitle("Gestão de Vistorias diz:")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result?.cancel() }
                    .setCancelable(false)
                    .show()
                return true
            }

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
                                var explicitIntent = pm.getLaunchIntentForPackage(preferredPkg)
                                if (explicitIntent == null) {
                                    explicitIntent = Intent(captureIntent).apply {
                                        setPackage(preferredPkg)
                                        putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                                        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                                    }
                                }
                                startActivityForResult(explicitIntent, FILE_CHOOSER_RESULT_CODE)
                                return true
                            } catch (e: Exception) {
                                e.printStackTrace()
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
                                    val selectedLabel = names[which]
                                    if (selectedPkg != null) {
                                        prefs.edit()
                                            .putString("preferred_camera_package", selectedPkg)
                                            .putString("preferred_camera_label", selectedLabel)
                                            .commit()
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

        // Carregar o arquivo HTML local
        webView.loadUrl("file:///android_asset/index.html")

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
            photoResultReceived = false
            prefs.edit().putBoolean("should_check_new_photos", false).apply()
            webView.evaluateJavascript("typeof window.onPhotoCapturedFromAndroid") { result ->
                if (result != null && result.contains("function")) {
                    checkPhotosStartTime = prefs.getLong("check_photos_start_time", 0)
                    activeCameraVehicleName = prefs.getString("active_camera_vehicle_name", "") ?: ""
                    shouldCheckNewPhotos = false

                    Toast.makeText(this, "Importando fotos para a pasta da vistoria...", Toast.LENGTH_SHORT).show()
                    webView.postDelayed({
                        importedPhotoNames.clear()
                        scanDirectoriesForNewPhotos(checkPhotosStartTime)
                    }, 800)
                }
            }
        }
    }

    private fun scanPhysicalCameraFolder(startTime: Long): Int {
        var importedCount = 0
        if (startTime == 0L || System.currentTimeMillis() - startTime > 300_000) return 0
        val dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
        val movies = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
        val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
        val foldersToCheck = arrayOf(
            File(dcim, "Camera"),
            File(dcim, "OpenCamera"),
            File(dcim, "100ANDRO"),
            File(pictures, "Camera"),
            File(pictures, "OpenCamera"),
            File(movies, "Camera"),
            File(movies, "OpenCamera"),
            File(downloads, "Camera")
        )
        
        for (folder in foldersToCheck) {
            if (folder.exists() && folder.isDirectory) {
                val files = folder.listFiles() ?: continue
                for (file in files) {
                    if (file.isFile && file.length() > 0) {
                        val name = file.name
                        if (importedPhotoNames.contains(name)) continue
                        
                        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                        val customFolderName = prefs.getString("selected_folder_name", null) ?: prefs.getString("photo_folder_name_friendly", null) ?: ""
                        val absPath = file.absolutePath.lowercase()
                        if (absPath.contains("/vistorias/") || (customFolderName.isNotEmpty() && absPath.contains("/${customFolderName.lowercase()}/"))) {
                            continue
                        }
                        
                        // Check if file was modified after camera session started (with 15s margin)
                        if (file.lastModified() >= (startTime - 15000)) {
                            try {
                                val saved = java.io.FileInputStream(file).use { inputStream ->
                                    savePhotoDirectly(activeCameraVehicleName, name, inputStream)
                                }
                                if (saved) {
                                    val deleted = file.delete()
                                    if (!deleted) {
                                        try {
                                            contentResolver.delete(
                                                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                                "${MediaStore.MediaColumns.DATA} = ?",
                                                arrayOf(file.absolutePath)
                                            )
                                            contentResolver.delete(
                                                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                                                "${MediaStore.MediaColumns.DATA} = ?",
                                                arrayOf(file.absolutePath)
                                            )
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                    android.media.MediaScannerConnection.scanFile(
                                        this@MainActivity,
                                        arrayOf(file.absolutePath),
                                        null,
                                        null
                                    )
                                    deleteOriginalPhoto(name)
                                    runOnUiThread {
                                        webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$activeCameraVehicleName', '$name', '')", null)
                                    }
                                    importedPhotoNames.add(name)
                                    importedCount++
                                    android.util.Log.d("Vistoria", "Imported and moved physical file: ${file.absolutePath}")
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
            var toastShown = false
            for (attempt in 1..40) { // Check for 40 seconds
                val physCount = scanPhysicalCameraFolder(startTime)
                val imagesCount = queryMediaStoreForNewMedia(startTime, isVideo = false)
                val videosCount = queryMediaStoreForNewMedia(startTime, isVideo = true)
                val totalImported = physCount + imagesCount + videosCount
                if (totalImported > 0 && !toastShown) {
                    toastShown = true
                    runOnUiThread {
                        Toast.makeText(this, "✅ $totalImported arquivo(s) importado(s)!", Toast.LENGTH_SHORT).show()
                    }
                    // Após importar com sucesso, aguarda mais alguns segundos e para
                    Thread.sleep(5000)
                    break
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
        if (startTime == 0L || System.currentTimeMillis() - startTime > 300_000) return 0
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
                    
                    // Exclude files already inside Vistorias folder or custom selected folder
                    val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                    val customFolderName = prefs.getString("selected_folder_name", null) ?: prefs.getString("photo_folder_name_friendly", null) ?: ""
                    if (absolutePath != null) {
                        val lowerPath = absolutePath.lowercase()
                        if (lowerPath.contains("/vistorias/") || (customFolderName.isNotEmpty() && lowerPath.contains("/${customFolderName.lowercase()}/"))) {
                            continue
                        }
                    }
                    
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
                                importedMediaStoreIds.add(id)
                                importedPhotoNames.add(name)
                                
                                try {
                                    contentResolver.delete(contentUri, null, null)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                                deleteOriginalPhoto(name)

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
                photoResultReceived = true
                val vehicleName = activeCameraVehicleName
                val photoFile = File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), "IMG_temp.jpg")
                val videoFile = File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "VID_temp.mp4")
                val dataUri = data?.data

                Thread {
                    try {
                        var saved = false
                        var savedFilename = ""
                        var isVideoCaptured = false

                        if (dataUri != null) {
                            val mimeType = contentResolver.getType(dataUri) ?: ""
                            isVideoCaptured = mimeType.startsWith("video") || dataUri.toString().contains("video")
                            savedFilename = if (isVideoCaptured) "midia_${System.currentTimeMillis()}.mp4" else "foto_${System.currentTimeMillis()}.jpg"
                            saved = contentResolver.openInputStream(dataUri)?.use { inputStream ->
                                savePhotoDirectly(vehicleName, savedFilename, inputStream)
                            } ?: false
                        }

                        if (!saved && photoFile.exists() && photoFile.length() > 0) {
                            savedFilename = "foto_${System.currentTimeMillis()}.jpg"
                            saved = photoFile.inputStream().use { inputStream ->
                                savePhotoDirectly(vehicleName, savedFilename, inputStream)
                            }
                            if (saved) photoFile.delete()
                        }

                        if (!saved && videoFile.exists() && videoFile.length() > 0) {
                            isVideoCaptured = true
                            savedFilename = "midia_${System.currentTimeMillis()}.mp4"
                            saved = videoFile.inputStream().use { inputStream ->
                                savePhotoDirectly(vehicleName, savedFilename, inputStream)
                            }
                            if (saved) videoFile.delete()
                        }

                        if (saved) {
                            val finalIsVideo = isVideoCaptured
                            val finalFilename = savedFilename
                            runOnUiThread {
                                webView.evaluateJavascript("window.onPhotoCapturedFromAndroid('$vehicleName', '$finalFilename', '')", null)
                                if (finalIsVideo) {
                                    Toast.makeText(this@MainActivity, "✅ Vídeo salvo na pasta!", Toast.LENGTH_SHORT).show()
                                }
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
                        val folderName = getDocumentTreeFolderName(treeUri)
                        prefs.edit()
                            .putString("selected_folder_uri", treeUri.toString())
                            .putString("selected_folder_name", folderName)
                            .putString("photo_folder_name_friendly", folderName)
                            .apply()

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
        if (requestCode == 9988 && resultCode == Activity.RESULT_OK) {
            val uri = data?.data
            if (uri != null && pendingBackupJson != null) {
                try {
                    contentResolver.openOutputStream(uri)?.use { os ->
                        os.write(pendingBackupJson!!.toByteArray())
                    }
                    Toast.makeText(this, "✅ Backup salvo com sucesso no local escolhido!", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Erro ao salvar backup: ${e.message}", Toast.LENGTH_LONG).show()
                } finally {
                    pendingBackupJson = null
                }
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
                    photoResultReceived = true // O usuário selecionou arquivos
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
                            val selectedLabel = names[which]
                            prefs.edit()
                                .putString("preferred_camera_package", selectedPkg)
                                .putString("preferred_camera_label", selectedLabel)
                                .commit()
                            dialog.dismiss()
                            startCameraAndRecordTime(selectedPkg)
                        }
                        .setNegativeButton("Cancelar", null)
                        .show()
                }
                return
            } else if (cameraActivities.size == 1) {
                val selectedPkg = cameraActivities[0].activityInfo.packageName
                val selectedLabel = cameraActivities[0].loadLabel(pm).toString()
                prefs.edit()
                    .putString("preferred_camera_package", selectedPkg)
                    .putString("preferred_camera_label", selectedLabel)
                    .commit()
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
            intent = Intent(android.provider.MediaStore.INTENT_ACTION_VIDEO_CAMERA)
            val resolved = pm.queryIntentActivities(intent, 0)
            if (resolved.isEmpty()) {
                intent = Intent(android.provider.MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
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
        try {
            val dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
            val movies = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
            val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            val foldersToClean = arrayOf(
                File(dcim, "Camera"),
                File(dcim, "OpenCamera"),
                File(dcim, "100ANDRO"),
                File(pictures, "Camera"),
                File(pictures, "OpenCamera"),
                File(movies, "Camera"),
                File(movies, "OpenCamera"),
                File(downloads, "Camera")
            )
            for (folder in foldersToClean) {
                if (folder.exists() && folder.isDirectory) {
                    val orig = File(folder, filename)
                    if (orig.exists() && orig.isFile && !orig.absolutePath.contains("/Vistorias/", ignoreCase = true)) {
                        orig.delete()
                        android.media.MediaScannerConnection.scanFile(this, arrayOf(orig.absolutePath), null, null)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun savePhotoDirectly(vehicleName: String, filename: String, sourceStream: java.io.InputStream): Boolean {
        val cleanVehicleName = sanitizeFilename(vehicleName)
        val cleanFilename = sanitizeFilename(filename)
        val prefs = getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val savedUriStr = prefs.getString("selected_folder_uri", null)

        val lowerName = filename.lowercase()
        val isVideo = lowerName.endsWith(".mp4") || lowerName.endsWith(".3gp") || lowerName.endsWith(".mov") || lowerName.endsWith(".mkv") || lowerName.endsWith(".webm")
        val mimeType = if (isVideo) "video/mp4" else "image/jpeg"

        // 1. SAF Custom Folder
        if (savedUriStr != null) {
            try {
                val rootUri = Uri.parse(savedUriStr)
                val rootFolder = DocumentFile.fromTreeUri(this, rootUri)
                if (rootFolder != null && rootFolder.exists()) {
                    val vehicleFolder = getOrCreateDirectory(rootFolder, cleanVehicleName)
                    if (vehicleFolder != null) {
                        val existingFile = getFileInDirectory(vehicleFolder, cleanFilename)
                        if (existingFile != null && existingFile.length() > 0) {
                            return true
                        }
                        val newFile = vehicleFolder.createFile(mimeType, cleanFilename)
                        if (newFile != null) {
                            contentResolver.openOutputStream(newFile.uri)?.use { ops ->
                                sourceStream.copyTo(ops)
                            }
                            android.util.Log.d("Vistoria", "Saved safely via SAF: ${newFile.uri}")
                            return true
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 2. Default Public Folder: Pictures/Vistorias/$cleanVehicleName/
        try {
            val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            val rootVistorias = File(picturesDir, "Vistorias/$cleanVehicleName")
            if (!rootVistorias.exists()) rootVistorias.mkdirs()
            val targetFile = File(rootVistorias, cleanFilename)
            if (targetFile.exists() && targetFile.length() > 0) {
                return true
            }
            java.io.FileOutputStream(targetFile).use { ops ->
                sourceStream.copyTo(ops)
            }
            android.media.MediaScannerConnection.scanFile(this, arrayOf(targetFile.absolutePath), arrayOf(mimeType), null)
            android.util.Log.d("Vistoria", "Saved directly to Pictures/Vistorias folder: ${targetFile.absolutePath}")
            return true
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 3. MediaStore Fallback: Pictures/Vistorias/$cleanVehicleName/
        try {
            val resolver = contentResolver
            val relativePath = "Pictures/Vistorias/$cleanVehicleName/"
            val targetUri = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            
            val projection = arrayOf(MediaStore.MediaColumns._ID)
            val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?"
            val selectionArgs = arrayOf(cleanFilename, relativePath)
            resolver.query(targetUri, projection, selection, selectionArgs, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    return true
                }
            }

            val contentValues = android.content.ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, cleanFilename)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            }
            val uri = resolver.insert(targetUri, contentValues)
            if (uri != null) {
                resolver.openOutputStream(uri)?.use { ops ->
                    sourceStream.copyTo(ops)
                }
                return true
            }
        } catch (err: Exception) {
            err.printStackTrace()
        }
        return false
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
                mainAct.photoResultReceived = false
                prefs.edit().putBoolean("should_check_new_photos", false).apply()
                
                mainAct.checkPhotosStartTime = prefs.getLong("check_photos_start_time", 0)
                mainAct.activeCameraVehicleName = prefs.getString("active_camera_vehicle_name", "") ?: ""
                mainAct.shouldCheckNewPhotos = false

                Toast.makeText(mainAct, "Importando fotos para a pasta da vistoria...", Toast.LENGTH_SHORT).show()
                mainAct.webView.postDelayed({
                    mainAct.scanDirectoriesForNewPhotos(mainAct.checkPhotosStartTime)
                }, 800)
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
        startShareWithDate(vehicleName, "Seguem as fotos da vistoria do veículo: $vehicleName", "")
    }

    @JavascriptInterface
    fun shareVistoriaWhatsApp(vehicleName: String, reportText: String) {
        activity.runOnUiThread {
            val mainAct = activity as MainActivity
            val cleanVehicleName = mainAct.sanitizeFilename(vehicleName)
            
            try {
                val clipboard = activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("RelatorioVistoria", reportText)
                clipboard.setPrimaryClip(clip)
            } catch (e: Exception) {
                e.printStackTrace()
            }

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

            val filesToShare = ArrayList<java.io.File>()
            val addedNames = HashSet<String>()
            val isSupervision = reportText.contains("Supervisão")

            fun checkAndAddFile(file: java.io.File) {
                if (file.exists() && file.isFile && file.length() > 0) {
                    val name = file.name.lowercase()
                    if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                        name.endsWith(".png") || name.endsWith(".mp4") ||
                        name.endsWith(".mov") || name.endsWith(".3gp") ||
                        name.endsWith(".mkv") || name.endsWith(".webm")) {
                        if (!addedNames.contains(name)) {
                            if (isSupervision) {
                                val fileDate = java.util.Date(file.lastModified())
                                val today = java.util.Date()
                                val fmt = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US)
                                if (fmt.format(fileDate) != fmt.format(today)) {
                                    return
                                }
                            }
                            addedNames.add(name)
                            filesToShare.add(file)
                        }
                    }
                }
            }

            try {
                // 1. Pictures/Vistorias/$cleanVehicleName
                val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                val vistoriasDir = java.io.File(picturesDir, "Vistorias/$cleanVehicleName")
                if (vistoriasDir.exists()) {
                    val files = vistoriasDir.listFiles()
                    if (files != null) {
                        for (file in files) {
                            checkAndAddFile(file)
                        }
                    }
                }

                // 2. Subdiretórios em Pictures/Vistorias/
                val vistoriasBaseDir = java.io.File(picturesDir, "Vistorias")
                if (vistoriasBaseDir.exists()) {
                    val subDirs = vistoriasBaseDir.listFiles { file -> file.isDirectory }
                    if (subDirs != null) {
                        val cleanLower = cleanVehicleName.lowercase().replace(" ", "").replace("-", "")
                        for (dir in subDirs) {
                            val dirNameLower = dir.name.lowercase().replace(" ", "").replace("-", "")
                            if (dirNameLower.contains(cleanLower) || (cleanLower.length > 3 && dirNameLower.contains(cleanLower))) {
                                val files = dir.listFiles()
                                if (files != null) {
                                    for (file in files) {
                                        checkAndAddFile(file)
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. Diretórios de Câmera padrão (DCIM/Camera, Pictures/Camera, DCIM/Vistorias)
                val dcimDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
                val cameraDirs = listOf(
                    java.io.File(dcimDir, "Camera"),
                    java.io.File(dcimDir, "Vistorias/$cleanVehicleName"),
                    java.io.File(picturesDir, "Camera"),
                    activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES),
                    activity.getExternalFilesDir(null)
                )

                val cleanLower = cleanVehicleName.lowercase().replace(" ", "").replace("-", "")
                for (cDir in cameraDirs) {
                    if (cDir != null && cDir.exists()) {
                        val files = cDir.listFiles()
                        if (files != null) {
                            for (file in files) {
                                if (file.isFile && file.length() > 0) {
                                    val nameLower = file.name.lowercase()
                                    if (nameLower.contains(cleanLower) || (cleanLower.length > 3 && nameLower.contains(cleanLower))) {
                                        checkAndAddFile(file)
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Arquivos do SAF (se pasta personalizada foi selecionada)
                val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
                val savedUriStr = prefs.getString("selected_folder_uri", null)
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
                                        val name = file.name ?: ""
                                        val lowerName = name.lowercase()
                                        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
                                            lowerName.endsWith(".png") || lowerName.endsWith(".mp4") ||
                                            lowerName.endsWith(".mov") || lowerName.endsWith(".3gp") ||
                                            lowerName.endsWith(".mkv") || lowerName.endsWith(".webm")) {
                                            if (!addedNames.contains(lowerName)) {
                                                if (isSupervision) {
                                                    val fileDate = java.util.Date(file.lastModified())
                                                    val today = java.util.Date()
                                                    val fmt = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US)
                                                    if (fmt.format(fileDate) != fmt.format(today)) {
                                                        continue
                                                    }
                                                }
                                                try {
                                                    val tempFile = java.io.File(cacheDir, name)
                                                    activity.contentResolver.openInputStream(file.uri)?.use { input ->
                                                        java.io.FileOutputStream(tempFile).use { output ->
                                                            input.copyTo(output)
                                                        }
                                                    }
                                                    if (tempFile.exists() && tempFile.length() > 0) {
                                                        addedNames.add(lowerName)
                                                        filesToShare.add(tempFile)
                                                        tempShareFiles.add(tempFile)
                                                    }
                                                } catch (e: Exception) {
                                                    e.printStackTrace()
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // 5. Fallback: Se nenhuma mídia foi encontrada pela placa, varre mídias criadas nas últimas 48h em Pictures/Vistorias/
                if (filesToShare.isEmpty() && vistoriasBaseDir.exists()) {
                    val now = System.currentTimeMillis()
                    val twoDaysAgo = now - (48 * 3600 * 1000L)
                    val allFiles = vistoriasBaseDir.listFiles()
                    if (allFiles != null) {
                        for (file in allFiles) {
                            if (file.isFile && file.length() > 0 && file.lastModified() >= twoDaysAgo) {
                                if (isSupervision) {
                                    val fileDate = java.util.Date(file.lastModified())
                                    val today = java.util.Date()
                                    val fmt = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US)
                                    if (fmt.format(fileDate) != fmt.format(today)) {
                                        continue
                                    }
                                }
                                checkAndAddFile(file)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val uris = ArrayList<Uri>()
            val addedUriStrings = HashSet<String>()
            for (file in filesToShare) {
                try {
                    val uri = androidx.core.content.FileProvider.getUriForFile(
                        activity,
                        "com.example.vistoriainicial.fileprovider",
                        file
                    )
                    val uriStr = uri.toString()
                    if (!addedUriStrings.contains(uriStr)) {
                        addedUriStrings.add(uriStr)
                        uris.add(uri)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            val pm = activity.packageManager
            var whatsappPkg: String? = null
            try {
                pm.getPackageInfo("com.whatsapp", 0)
                whatsappPkg = "com.whatsapp"
            } catch (e: Exception) {
                try {
                    pm.getPackageInfo("com.whatsapp.w4b", 0)
                    whatsappPkg = "com.whatsapp.w4b"
                } catch (ex: Exception) {
                    whatsappPkg = null
                }
            }

            if (whatsappPkg == null) {
                Toast.makeText(activity, "WhatsApp não está instalado no aparelho!", Toast.LENGTH_LONG).show()
                return@runOnUiThread
            }

            if (uris.isEmpty()) {
                Toast.makeText(activity, "Nenhuma foto/vídeo encontrado para $vehicleName. Enviando relatório de texto...", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(activity, "Abrindo WhatsApp com ${uris.size} mídias...", Toast.LENGTH_SHORT).show()
            }

            val hasVideosOnly = filesToShare.all { f -> 
                val name = f.name.lowercase()
                name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".3gp") || name.endsWith(".mkv") || name.endsWith(".webm")
            }
            val shareType = if (hasVideosOnly) "video/*" else "image/*"

            val intent = Intent().apply {
                setPackage(whatsappPkg)
                if (uris.isEmpty()) {
                    action = Intent.ACTION_SEND
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, reportText)
                } else if (uris.size == 1) {
                    action = Intent.ACTION_SEND
                    type = shareType
                    putExtra(Intent.EXTRA_STREAM, uris[0])
                    putExtra(Intent.EXTRA_TEXT, reportText)
                } else {
                    action = Intent.ACTION_SEND_MULTIPLE
                    type = shareType
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                    putExtra(Intent.EXTRA_TEXT, reportText)
                }
                if (uris.isNotEmpty()) {
                    val clip = android.content.ClipData.newRawUri("Vistoria", uris[0])
                    for (i in 1 until uris.size) {
                        clip.addItem(android.content.ClipData.Item(uris[i]))
                    }
                    clipData = clip
                }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            for (uri in uris) {
                try {
                    activity.grantUriPermission("com.whatsapp", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    activity.grantUriPermission("com.whatsapp.w4b", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    if (whatsappPkg != null) {
                        activity.grantUriPermission(whatsappPkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            try {
                activity.startActivity(intent)
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Erro ao abrir WhatsApp: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    @JavascriptInterface
    fun startShare(vehicleName: String, reportText: String) {
        startShareWithDate(vehicleName, reportText, "")
    }

    @JavascriptInterface
    fun startShareWithDate(vehicleName: String, reportText: String, targetDate: String) {
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

            val isSupervision = reportText.contains("Supervisão")
            fun isSameDate(lastModified: Long): Boolean {
                if (isSupervision) {
                    val fileDate = java.util.Date(lastModified)
                    val today = java.util.Date()
                    val fmt = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US)
                    return fmt.format(fileDate) == fmt.format(today)
                }
                return true
            }

            val filesToCopy = ArrayList<java.io.File>()
            val safPairsToCopy = ArrayList<Pair<String, Uri>>()

            if (savedUriStr != null) {
                try {
                    val rootUri = Uri.parse(savedUriStr)
                    val rootFolder = androidx.documentfile.provider.DocumentFile.fromTreeUri(activity, rootUri)
                    if (rootFolder != null && rootFolder.exists()) {
                        val vehicleFolder = mainAct.getOrCreateDirectory(rootFolder, cleanVehicleName)
                        if (vehicleFolder != null && vehicleFolder.exists()) {
                            val files = vehicleFolder.listFiles()
                            for (file in files) {
                                if (file.isFile && isSameDate(file.lastModified())) {
                                    val name = file.name ?: ""
                                    val lowerName = name.lowercase()
                                    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
                                        lowerName.endsWith(".png") || lowerName.endsWith(".mp4") ||
                                        lowerName.endsWith(".mov") || lowerName.endsWith(".3gp") ||
                                        lowerName.endsWith(".mkv")) {
                                        safPairsToCopy.add(Pair(name, file.uri))
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
                            if (file.isFile && file.length() > 0 && isSameDate(file.lastModified())) {
                                val name = file.name.lowercase()
                                if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                                    name.endsWith(".png") || name.endsWith(".mp4") ||
                                    name.endsWith(".mov") || name.endsWith(".3gp") ||
                                    name.endsWith(".mkv") || name.endsWith(".webm")) {
                                    filesToCopy.add(file)
                                }
                            }
                        }
                    }
                }
                
                val vistoriasBaseDir = java.io.File(picturesDir, "Vistorias")
                if (vistoriasBaseDir.exists()) {
                    val subDirs = vistoriasBaseDir.listFiles { file -> file.isDirectory }
                    if (subDirs != null) {
                        val cleanLower = cleanVehicleName.lowercase().replace(" ", "").replace("-", "")
                        for (dir in subDirs) {
                            val dirNameLower = dir.name.lowercase().replace(" ", "").replace("-", "")
                            if (dirNameLower.contains(cleanLower) || (cleanLower.length > 3 && dirNameLower.contains(cleanLower))) {
                                val files = dir.listFiles()
                                if (files != null) {
                                    for (file in files) {
                                        if (file.isFile && file.length() > 0 && isSameDate(file.lastModified())) {
                                            val name = file.name.lowercase()
                                            if (name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                                                name.endsWith(".png") || name.endsWith(".mp4") ||
                                                name.endsWith(".mov") || name.endsWith(".3gp") ||
                                                name.endsWith(".mkv") || name.endsWith(".webm")) {
                                                filesToCopy.add(file)
                                            }
                                        }
                                    }
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
                                if (file.isFile && isSameDate(file.lastModified())) {
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

            try {
                val rootVistorias = java.io.File(Environment.getExternalStorageDirectory(), "Vistorias/$cleanVehicleName")
                if (rootVistorias.exists()) {
                    val files = rootVistorias.listFiles()
                    if (files != null) {
                        for (file in files) {
                            if (file.isFile && isSameDate(file.lastModified())) {
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
                val moviesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
                val vistoriasMoviesDir = java.io.File(moviesDir, "Vistorias/$cleanVehicleName")
                if (vistoriasMoviesDir.exists()) {
                    val files = vistoriasMoviesDir.listFiles()
                    if (files != null) {
                        for (file in files) {
                            if (file.isFile && isSameDate(file.lastModified())) {
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
                val mediaUris = arrayOf(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                )
                for (contentUri in mediaUris) {
                    val projection = arrayOf(
                        MediaStore.MediaColumns._ID,
                        MediaStore.MediaColumns.DISPLAY_NAME,
                        MediaStore.MediaColumns.DATA,
                        MediaStore.MediaColumns.DATE_MODIFIED
                    )
                    val selection = "${MediaStore.MediaColumns.DATA} LIKE ? OR ${MediaStore.MediaColumns.RELATIVE_PATH} LIKE ?"
                    val selectionArgs = arrayOf("%Vistorias/$cleanVehicleName/%", "%Vistorias/$cleanVehicleName/%")
                    activity.contentResolver.query(contentUri, projection, selection, selectionArgs, null)?.use { cursor ->
                        val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                        val dataCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)
                        val dateModCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
                        while (cursor.moveToNext()) {
                            val filePath = cursor.getString(dataCol)
                            val fileName = cursor.getString(nameCol) ?: ""
                            val dateModSec = cursor.getLong(dateModCol)
                            if (filePath != null && fileName.isNotEmpty() && isSameDate(dateModSec * 1000)) {
                                val file = java.io.File(filePath)
                                if (file.exists() && file.isFile && file.length() > 0) {
                                    filesToCopy.add(file)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val shareFiles = ArrayList<java.io.File>()
            val uris = ArrayList<Uri>()
            val addedNames = HashSet<String>()
            val addedUriStrings = HashSet<String>()

            for (pair in safPairsToCopy) {
                val origName = pair.first
                val lowerName = origName.lowercase()
                val uri = pair.second
                try {
                    if (addedNames.contains(lowerName)) continue
                    addedNames.add(lowerName)
                    val uriStr = uri.toString()
                    if (!addedUriStrings.contains(uriStr)) {
                        addedUriStrings.add(uriStr)
                        uris.add(uri)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            for (file in filesToCopy) {
                try {
                    if (file.exists() && file.length() > 0) {
                        val lowerName = file.name.lowercase()
                        if (addedNames.contains(lowerName)) continue
                        addedNames.add(lowerName)
                        
                        val uri = androidx.core.content.FileProvider.getUriForFile(
                            activity,
                            "com.example.vistoriainicial.fileprovider",
                            file
                        )
                        val uriStr = uri.toString()
                        if (!addedUriStrings.contains(uriStr)) {
                            addedUriStrings.add(uriStr)
                            uris.add(uri)
                            shareFiles.add(file)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            if (uris.isEmpty()) {
                try {
                    val textIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "Relatório da Vistoria: $vehicleName")
                        putExtra(Intent.EXTRA_TEXT, reportText)
                    }
                    val chooser = Intent.createChooser(textIntent, "Compartilhar Relatório")
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    activity.startActivity(chooser)
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(activity, "Erro ao compartilhar relatório: ${e.message}", Toast.LENGTH_SHORT).show()
                }
                return@runOnUiThread
            }

            try {
                try {
                    val clipboard = activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("RelatorioVistoria", reportText)
                    clipboard.setPrimaryClip(clip)
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                val shareAction = if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE
                val hasImages = shareFiles.any { f -> 
                    val name = f.name.lowercase()
                    name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png")
                }
                val hasVideos = shareFiles.any { f -> 
                    val name = f.name.lowercase()
                    name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".3gp") || name.endsWith(".mkv") || name.endsWith(".webm")
                }
                val shareType = if (hasImages && hasVideos) "*/*" else if (hasVideos) "video/*" else "image/*"

                val intent = Intent().apply {
                    action = shareAction
                    type = shareType
                    if (uris.size == 1) {
                        putExtra(Intent.EXTRA_STREAM, uris[0])
                    } else {
                        putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                    }
                    putExtra(Intent.EXTRA_SUBJECT, "Relatório da Vistoria: $vehicleName")
                    putExtra(Intent.EXTRA_TEXT, reportText)
                    if (uris.isNotEmpty()) {
                        clipData = android.content.ClipData.newRawUri("Vistoria", uris[0])
                        for (i in 1 until uris.size) {
                            clipData?.addItem(android.content.ClipData.Item(uris[i]))
                        }
                    }
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                
                val chooser = Intent.createChooser(intent, "Compartilhar Vistoria: $vehicleName")
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                
                val resInfoList = activity.packageManager.queryIntentActivities(chooser, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
                for (resolveInfo in resInfoList) {
                    val packageName = resolveInfo.activityInfo.packageName
                    for (uri in uris) {
                        activity.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                }

                activity.startActivity(chooser)
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
    fun getSelectedFolderName(): String {
        val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val savedName = prefs.getString("selected_folder_name", null) ?: prefs.getString("photo_folder_name_friendly", null)
        if (!savedName.isNullOrEmpty()) return savedName

        val savedUriStr = prefs.getString("selected_folder_uri", null)
        if (!savedUriStr.isNullOrEmpty()) {
            return try {
                val rootUri = Uri.parse(savedUriStr)
                val documentFile = androidx.documentfile.provider.DocumentFile.fromTreeUri(activity, rootUri)
                documentFile?.name ?: "Pasta Selecionada"
            } catch (e: Exception) {
                "Pasta Selecionada"
            }
        }
        return "Pictures/Vistorias (Padrão)"
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
    fun selectPreferredCamera() {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            val pm = mainAct.packageManager
            val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val launcherActivities = pm.queryIntentActivities(launcherIntent, 0)
            val cameraActivities = ArrayList<android.content.pm.ResolveInfo>()
            val cameraKeywords = listOf("camera", "câmera", "camer", "foto", "photo", "gcam", "opencamera", "camara")
            
            for (info in launcherActivities) {
                val pkgName = info.activityInfo.packageName.lowercase()
                val label = info.loadLabel(pm).toString().lowercase()
                if (pkgName == mainAct.packageName.lowercase()) continue
                val isCameraApp = cameraKeywords.any { pkgName.contains(it) || label.contains(it) }
                if (isCameraApp) {
                    cameraActivities.add(info)
                }
            }

            if (cameraActivities.isNotEmpty()) {
                val names = ArrayList<String>()
                val packages = ArrayList<String>()
                for (resolveInfo in cameraActivities) {
                    names.add(resolveInfo.loadLabel(pm).toString())
                    packages.add(resolveInfo.activityInfo.packageName)
                }
                
                android.app.AlertDialog.Builder(mainAct)
                    .setTitle("Selecione a Câmera Preferida")
                    .setItems(names.toTypedArray()) { dialog, which ->
                        val selectedPkg = packages[which]
                        val label = names[which]
                        prefs.edit()
                            .putString("preferred_camera_package", selectedPkg)
                            .putString("preferred_camera_label", label)
                            .commit()
                        dialog.dismiss()
                        Toast.makeText(mainAct, "Câmera preferida salva: $label", Toast.LENGTH_SHORT).show()
                        mainAct.webView.evaluateJavascript("if (typeof updatePreferredCameraUI === 'function') updatePreferredCameraUI();", null)
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            } else {
                Toast.makeText(mainAct, "Nenhum aplicativo de câmera encontrado.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun clearPreferredCamera() {
        val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().remove("preferred_camera_package").remove("preferred_camera_label").commit()
        activity.runOnUiThread {
            Toast.makeText(activity, "Preferência de câmera limpa!", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getPreferredCameraLabel(): String {
        val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
        val savedLabel = prefs.getString("preferred_camera_label", null)
        val pkg = prefs.getString("preferred_camera_package", null)
        if (pkg == null && savedLabel == null) return "Nenhuma"
        if (savedLabel != null && savedLabel.isNotEmpty()) return savedLabel
        return try {
            if (pkg != null) {
                val pm = activity.packageManager
                val appInfo = pm.getApplicationInfo(pkg, 0)
                pm.getApplicationLabel(appInfo).toString()
            } else "Nenhuma"
        } catch (e: Exception) {
            "Câmera Preferida"
        }
    }

    @JavascriptInterface
    fun savePhoto(vehicleName: String, filename: String, base64Data: String) {
        savePhoto(vehicleName, filename, base64Data, "Vistorias")
    }

    @JavascriptInterface
    fun savePhotoSync(vehicleName: String, filename: String, base64Data: String): Boolean {
        val mainAct = activity as MainActivity
        val data: ByteArray
        try {
            data = Base64.decode(base64Data, Base64.DEFAULT)
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
        return try {
            val saved = java.io.ByteArrayInputStream(data).use { inputStream ->
                mainAct.savePhotoDirectly(vehicleName, filename, inputStream)
            }
            if (saved) {
                mainAct.deleteOriginalPhoto(mainAct.sanitizeFilename(filename))
            }
            saved
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
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
            
            var opened = false

            try {
                val builder = android.os.StrictMode.VmPolicy.Builder()
                android.os.StrictMode.setVmPolicy(builder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }

            if (savedUriStr != null) {
                // Pasta customizada foi selecionada
                try {
                    val rootUri = Uri.parse(savedUriStr)
                    val rootFolder = androidx.documentfile.provider.DocumentFile.fromTreeUri(activity, rootUri)
                    if (rootFolder != null && rootFolder.exists()) {
                        val vehicleFolder = mainAct.getOrCreateDirectory(rootFolder, cleanVehicleName)
                        if (vehicleFolder != null && vehicleFolder.exists()) {
                            val vehicleFolderUri = vehicleFolder.uri
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(vehicleFolderUri, "vnd.android.document/directory")
                                putExtra("android.provider.extra.INITIAL_URI", vehicleFolderUri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            activity.startActivity(intent)
                            opened = true
                            Toast.makeText(activity, "Abrindo pasta customizada...", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(activity, "Erro de permissão na pasta customizada. Usando padrão.", Toast.LENGTH_LONG).show()
                    // Vamos deixar prosseguir para a pasta padrão caso dê erro na customizada.
                }
            } 
            
            if (!opened) {
                // Tenta abrir a pasta padrão caso a customizada não exista, tenha dado erro ou não esteja setada
                val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                val vistoriasDir = java.io.File(picturesDir, "Vistorias/$cleanVehicleName")
                if (!vistoriasDir.exists()) vistoriasDir.mkdirs()

                try {
                    val contentUri = androidx.core.content.FileProvider.getUriForFile(activity, "com.example.vistoriainicial.fileprovider", vistoriasDir)
                    val genericIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(contentUri, "*/*")
                        putExtra("current_path", vistoriasDir.absolutePath)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    }
                    activity.startActivity(Intent.createChooser(genericIntent, "Abrir pasta da vistoria"))
                } catch (ex: Exception) {
                    ex.printStackTrace()
                    Toast.makeText(activity, "Erro ao abrir a pasta.", Toast.LENGTH_SHORT).show()
                }
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

    @JavascriptInterface
    fun exportBackup(filename: String, jsonContent: String) {
        activity.runOnUiThread {
            try {
                (activity as MainActivity).pendingBackupJson = jsonContent
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, filename)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivityForResult(Intent.createChooser(intent, "Escolha onde salvar o arquivo de backup"), 9988)
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(activity, "Erro ao abrir seletor de local: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    @JavascriptInterface
    fun createInspectionFolder(vehicleName: String) {
        val mainAct = activity as MainActivity
        mainAct.runOnUiThread {
            val cleanVehicleName = mainAct.sanitizeFilename(vehicleName)
            val prefs = activity.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val savedUriStr = prefs.getString("selected_folder_uri", null)
            
            if (savedUriStr != null) {
                try {
                    val rootUri = android.net.Uri.parse(savedUriStr)
                    val rootFolder = androidx.documentfile.provider.DocumentFile.fromTreeUri(activity, rootUri)
                    if (rootFolder != null && rootFolder.exists()) {
                        val existing = rootFolder.findFile(cleanVehicleName)
                        if (existing != null && existing.isDirectory) {
                            android.widget.Toast.makeText(activity, "A pasta '$cleanVehicleName' já existe!", android.widget.Toast.LENGTH_SHORT).show()
                        } else {
                            val created = rootFolder.createDirectory(cleanVehicleName)
                            if (created != null) {
                                android.widget.Toast.makeText(activity, "Pasta '$cleanVehicleName' gerada com sucesso!", android.widget.Toast.LENGTH_SHORT).show()
                            } else {
                                android.widget.Toast.makeText(activity, "Erro ao gerar pasta customizada.", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    } else {
                        android.widget.Toast.makeText(activity, "Pasta raiz não encontrada. Configure o local de salvamento novamente.", android.widget.Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    android.widget.Toast.makeText(activity, "Erro: " + e.message, android.widget.Toast.LENGTH_LONG).show()
                }
            } else {
                android.widget.Toast.makeText(activity, "Local de salvamento não configurado. Por favor, configure primeiro.", android.widget.Toast.LENGTH_LONG).show()
            }
        }
    }
}
