<?php
class NameGenerator {

    private $times = 0;
    public $step = 1;
    public $loop = 0;
    public $baseFilename = '';
    public $filenameExtension = '';

    public function __construct(int $step = 1, string $baseFilename = 'file-', $extension = '') {
        $this->step = $step;
        $this->baseFilename = $baseFilename;
        $this->filenameExtension = $extension;
    }

    public function current() {
        return sprintf('%s%d%s', $this->baseFilename, $this->loop + 1, $this->filenameExtension);
    }

    public function next() {
        $this->times++;
        if ($this->times >= $this->step) {
            $this->loop++;
            $this->times = 0;
        }
        return $this->current();
    }

    public function totalTimes() {
        return ($this->loop * $this->step) + $this->times;
    }

    public function driftReset() {
        return $this->times ? false : true;
    }

    public function times() {
        return $this->times;
    }

    public function currentPass() {
        return sprintf('%02d', $this->loop);
    }

    public function previousPass() {
        return sprintf('%02d', $this->loop - 1);
    }

    public function currentRange() {
        return sprintf('%02d-%02d', $this->loop * $this->step,  $this->totalTimes());
    }

    public function previousRange() {
        return sprintf('%02d-%02d', $this->previousPass() * $this->step,  $this->totalTimes() - 1);
    }
}

$value = 12;
$t = new NameGenerator($value);
for ($i = 0; $i <= ($value * 3) + 5; $i++) {
    $t->next();
    //printf(
    //    "%03d %02d %02d: %s %s\n",
    //    $t->totalTimes(),
    //    $t->times(),
    //    $t->loop,
    //    $t->driftReset(),
    //    $t->current()
    //);
    // echo $t->currentRange() . "\n";
}
