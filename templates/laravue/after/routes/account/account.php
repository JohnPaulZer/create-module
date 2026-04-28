<?php

use App\Http\Controllers\Account\AccountController;
use Illuminate\Support\Facades\Route;

Route::get('/accounts', [AccountController::class, 'index']);
