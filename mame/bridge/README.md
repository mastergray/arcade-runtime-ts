# MAME 0.161 web bridge

The C++ files in this directory are review copies of the sources added by the
production patches. The build consumes `mame/patches/0001-*` through
`0003-*`; it must not copy these files separately.

## Link contract

Link the family bitcode with the pinned Emscripten 1.38.31 toolchain and these
exact settings (in addition to the family preload arguments):

```sh
-O2
-s WASM=1
-s USE_SDL=2
-s MODULARIZE=1
-s 'EXPORT_NAME="createMame"'
-s TOTAL_MEMORY=268435456
-s ALLOW_MEMORY_GROWTH=0
-s NO_EXIT_RUNTIME=1
-s DISABLE_EXCEPTION_CATCHING=0
-s USE_PTHREADS=0
-s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]'
-s 'EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]'
```

`TOTAL_MEMORY` is fixed at 256 MiB and memory growth is disabled. Pthreads are
disabled explicitly; the output must use an unshared `WebAssembly.Memory`.
Exception catching remains enabled because MAME uses C++ exceptions for its
frontend error path. `NO_EXIT_RUNTIME` preserves the retained running-machine
stack after `callMain` returns.

Start MAME with `-video web -sound web -nothrottle -noautoframeskip
-joystick`. No SDL input provider is registered in that mode. The host owns
the outer loop and advances emulation only with `web_run_frames`.
