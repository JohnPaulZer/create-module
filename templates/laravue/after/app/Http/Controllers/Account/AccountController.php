<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Services\Account\AccountService;

class AccountController extends Controller
{
    public function index(): array
    {
        return (new AccountService())->all();
    }
}
